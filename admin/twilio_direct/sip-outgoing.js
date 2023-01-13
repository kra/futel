// From https://www.twilio.com/blog/registering-sip-phone-twilio-inbound-outbound
// Parse the destination number from the SIP URI.
// If the destination number matches one of our credentials, construct a SIP URI with our SIP domain
// and dial it.
// Otherwise, assume it is a PSTN number and dial it.

// TODO
// Add and update comments.
// Document requirements.
// Update or remove defaultCallerId munge? Assume client is correct?
// Can we send SNS to our monitoring here? Alternative is Twilio console?

// URL parameters: defaultCountry=[international country code - ISO alpha2]
// Require `PhoneNumberFormat`.

const PNF = require('google-libphonenumber').PhoneNumberFormat;
const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();

const credUtilPath = Runtime.getFunctions()['cred-util'].path;
const credUtil = require(credUtilPath);

exports.handler = function(context, event, callback) {
    const client = context.getTwilioClient();    
    let twiml = new Twilio.twiml.VoiceResponse();
    const { From: fromNumber, To: toNumber, SipDomainSid: sipDomainSid } = event;
    let regExNumericSipUri = /^sip:((\+)?[0-9]+)@(.*)/;

    // The caller ID is the SIP extension, which we assume is E.164.
    let fromSipCallerId = fromNumber.match(regExNumericSipUri)[1];
    let normalizedFrom = fromNumber.match(regExNumericSipUri)[1];
    let normalizedTo = toNumber.match(regExNumericSipUri)[1];
    let sipDomain =  toNumber.match(regExNumericSipUri)[3];

    console.log(`Original From Number: ${fromNumber}`);
    console.log(`Original To Number: ${toNumber}`);
    console.log(`Normalized PSTN From Number: ${normalizedFrom}`);
    console.log(`Normalized To Number: ${normalizedTo}`);     
    console.log(`SIP CallerID: ${fromSipCallerId}`);
    
    // Parse number with US country code and keep raw input.
    const rawFromNumber = phoneUtil.parseAndKeepRawInput(normalizedFrom, 'US');
    const rawtoNumber = phoneUtil.parseAndKeepRawInput(normalizedTo, 'US');    
    // Format number in E.164 format
    fromE164Normalized = phoneUtil.format(rawFromNumber, PNF.E164);
    toE164Normalized = phoneUtil.format(rawtoNumber, PNF.E164);

    console.log(`E.164 From Number: ${fromE164Normalized}`);
    console.log(`E.164 To Number: ${toE164Normalized}`);

    let mergedAggregatedE164CredentialUsernames = [];
    
    credUtil.enumerateCredentialLists(client, sipDomainSid).then(credentialLists => {
        Promise.all(credentialLists.map(credList => {
            return credUtil.getSIPCredentialListUsernames(client, credList.sid);
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
