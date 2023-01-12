// From https://www.twilio.com/blog/registering-sip-phone-twilio-inbound-outbound
// If destination number appears to be a SIP URI, dial it.
// If destination number appears to be NANPA, normalize it to E.164 and dial it.
// If destination number appears to be 911 or 933, dial it? At least it works.

// TODO
// Add and update comments.
// Document requirements.
// Update or remove defaultCallerId munge? Assume client is correct?
// Can we send SNS to our monitoring here? Alternative is Twilio console?

// URL parameters: defaultCountry=[international country code - ISO alpha2]
// Require `PhoneNumberFormat`.

const PNF = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

exports.handler = function(context, event, callback) {
    const client = context.getTwilioClient();    
    let twiml = new Twilio.twiml.VoiceResponse();
    const { From: fromNumber, To: toNumber, SipDomainSid: sipDomainSid } = event;
    let mergedAggregatedE164CredentialUsernames = [];
    let regExNumericSipUri = /^sip:((\+)?[0-9]+)@(.*)/;
    let regAlphaSipUri = /^sip:(([a-zA-Z][\w]+)@(.*))/;
    // Change the defaultCallerId to a phone number in your account
    let defaultCallerId = '+15005551212';
    let defaultCountry = event.defaultCountry || 'US';
    
    let fromSipCallerId = (fromNumber.match(regExNumericSipUri)
                           ? fromNumber.match(regExNumericSipUri)[1] :
                           fromNumber.match(regAlphaSipUri)[2]);

    if (!toNumber.match(regExNumericSipUri)) {
        console.log('Dialing an alphanumeric SIP User');
        twiml.dial({callerId: fromSipCallerId, answerOnBridge: true})
        .sip(toNumber);    
        callback(null, twiml);
    }

    let normalizedFrom = (fromNumber.match(regExNumericSipUri)
                          ? fromNumber.match(regExNumericSipUri)[1] : defaultCallerId);
    
    let normalizedTo = toNumber.match(regExNumericSipUri)[1];
    let sipDomain =  toNumber.match(regExNumericSipUri)[3];

    //console.log(`Original From Number: ${fromNumber}`);
    //console.log(`Original To Number: ${toNumber}`);
    //console.log(`Normalized PSTN From Number: ${normalizedFrom}`);
    //console.log(`Normalized To Number: ${normalizedTo}`);     
    //console.log(`SIP CallerID: ${fromSipCallerId}`);
    
    // Parse number with US country code and keep raw input.
    const rawFromNumber = phoneUtil.parseAndKeepRawInput(normalizedFrom, defaultCountry);
    const rawtoNumber = phoneUtil.parseAndKeepRawInput(normalizedTo, defaultCountry);    
    // Format number in E.164 format
    fromE164Normalized = phoneUtil.format(rawFromNumber, PNF.E164);
    toE164Normalized = phoneUtil.format(rawtoNumber, PNF.E164);

    console.log(`E.164 From Number: ${fromE164Normalized}`);
    console.log(`E.164 To Number: ${toE164Normalized}`);

    // Return a list of all CredentialLists for the SIP domain sid.
    function enumerateCredentialLists(sipDomainSid) {
        return client.sip.domains(sipDomainSid)
            .auth
            .registrations
            .credentialListMappings
            .list();
    }

    // Return a list of usernames from the given CredentialList sid.
    function getSIPCredentialListUsernames(credList) {
        return client.sip.credentialLists(credList)
            .credentials
            .list();  
    }
    
    enumerateCredentialLists(sipDomainSid).then(credentialLists => {
        Promise.all(credentialLists.map(credList => {
            return getSIPCredentialListUsernames(credList.sid);
        })).then(results => {
            results.forEach(credentials => {
                // Push all usernames which start with + into mergedAggregatedE164CredentialUsernames.
                mergedAggregatedE164CredentialUsernames.push
                    .apply(mergedAggregatedE164CredentialUsernames,
                           credentials.filter(record => record["username"].startsWith('+'))
                           .map(record => record.username));
            });
            //console.log(mergedAggregatedE164CredentialUsernames);
            if (mergedAggregatedE164CredentialUsernames.includes(toE164Normalized)) {
                // Our SIP Domain has a credential username which matches our To address.
                // Make a SIP URL for that username and our SIP domain, and dial it.
                console.log('Dialing another E.164 SIP User');
                twiml.dial({callerId: fromSipCallerId, answerOnBridge: true})
                    .sip(`sip:${toE164Normalized}@${sipDomain}`);
            } else {
                // We didn't match the To address, dial a PSTN number.
                console.log('Dialing a PSTN Number');
                twiml.dial({callerId: fromE164Normalized, answerOnBridge: true},
                           toE164Normalized);
            }    
            callback(null, twiml);
        }).catch(err => {
            console.log(err);
            callback(err);
        });
    });
};   
