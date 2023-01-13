# Setup for a Twilio SIP extension going directly to dialtone

## Objectives

- Allow SIP clients to make PSTN calls without requiring our server VOIP server or VPN.
- Separate the services we offer our clients to aid robustness and maintainability.

## Overview

Incoming from PSTN => Twilio phone number => TwiML bin => Twilio SIP domain => SIP client
Outgoing from SIP client => Twilio service => PSTN

Twilio services used:
- Voice Sip Domains
- Phone Numbers
- Service
- TwiML Bins
- Voice Credential Lists

## Setup

Create new credential list
- friendly name: (client)
- credential:
    - username: E.164 formated number (eg +15005551212)
    - password: (password)

Create service
- name: direct-outgoing
- dependencies:
    - module: google-libphonenumber
    - version: 3.2.30
    - module: twilio
    - version: 3.80.0
- remove welcome function
- create cred-util function
    - cred-util.js
- create sip-outgoing function
    - sip-outgoing.js
- save and deploy all                
- copy url of function for SIP domain later

Create new SIP domain
- friendly name direct-futel
- voice authentication:
    - credential lists: client credential list
- sip registration:
    - enabled
    - credential list: client credential list
- call control configuration:
    - a call comes in:
        - webhook
        - (URL of service function)
        - HTTP GET
- emergency calling: enabled

Create new TwiML bin
- friendly name: incoming direct-futel
- twiml:
        <?xml version="1.0" encoding="UTF-8"?>
            <Response>
                <Dial answerOnBridge="true">
                    <Sip>
         {{To}}@direct-futel.sip.us1.twilio.com
                    </Sip>
                </Dial>
        </Response>
                
Create new phone number
- friendly name: (client)
- emergency calling: (client address)
- voice and fax:
    - accept incoming: voice calls
    - configure with: Webhook, TwiML Bin, Function, Studio Flow, Proxy Service
    - a call comes in: TwiML Bin incoming direct-futel

Set up SIP client device
- nat keep alive: enable
- sip address: (E.164 number)@direct-futel.sip.twilio.com
- sip server address: <sip:direct-futel.sip.twilio.com;transport=tls>
- password: (Twilio credentential list password)
- Dial plan: (911|933|1[2-9]xxxxxxxxx|0111[2-9]xxxxxxxxx|[2-9]xxxxxxxxx)

Dial plan notes:

    Dial if we match:
    911
    933
    1 followed by 2-9 followed by 9 digits (E.164 with US country code)
    2-9 followed by 9 digits (NANPA ie US E.164 without country code)
    0111 followed by 2-9 followed by 9 digits (NANPA international ie 01 then E.164 with US country code)

## logging monitoring

- visit web page for direct-outgoing service, enable live logging, see console messages that arrive
- monitor tab
    - logs/calls
        - success outgoing calls from direct-outgoing service
        - success incoming calls to TwiML Bin (twilio got call)
        - fail incoming calls to SIP endpoing (unregistered)
    - logs/errors
        - fail incoming calls to SIP endpoing (unregistered)

XXX Can we integrate with our current monitoring? Set up a webhook to write a SNS message?

## Notes

https://www.twilio.com/blog/registering-sip-phone-twilio-inbound-outbound

If only making pstn calls the TwiML is sufficient. The JS lets us also call SIP devices, one fewer leg, also some other checking.

advantages
- general serverless advantages
- separate dialtone only clients from asterisk

drawbacks
- can't log client de/registration
- short delay before outgoing ring
- deployment and update is manual through web gui
    - we could instead use the Twilio CLI, local console commands
    - there is also a local test server in the Serverless Toolkit

- can we get our metrics?
- can we direct to asterisk for features eg pound for menu, operator?
- can we refer back if we do that?

Another option is to be less serverless. We can serve our own TwiML with the Twilio SDK in response to a POST from Twilio. This lets us e.g. publish our metrics in the way we are used to, use our server to decide how to react to messages, etc.

For dev/stage/prod develoment, create an Environment resource for each. For example, point to server or function locations.
