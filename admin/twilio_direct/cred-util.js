// CredentialList utilities.

// Return a list of all CredentialLists for the SIP domain sid.
function enumerateCredentialLists(client, sipDomainSid) {
    return client.sip.domains(sipDomainSid)
        .auth
        .registrations
        .credentialListMappings
        .list();
}

// Return a list of usernames from the given CredentialList.
function getSIPCredentialListUsernames(client, credList) {
    return client.sip.credentialLists(credList)
        .credentials
        .list();  
}

exports.enumerateCredentialLists = enumerateCredentialLists;
exports.getSIPCredentialListUsernames = getSIPCredentialListUsernames;
