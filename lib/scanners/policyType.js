/* jshint esversion: 6, node: true */

'use strict';

const lib = require('../index.js'),
      SCAN_NAME = 'policytype';

/*
* Accepts org, and a policyType name (Eg, RaiseFault, GenerateJWT,
* etc). Returns a function that accepts (name,revision) and scans
* the proxy revision for a policy of the given type.
**/
function getRevisionScanner(org, policyType, verboseOut) {

  let isMatch = (details) => details.policyType == policyType;

  function scanRevision({name, revision}) {
    function onePolicy(policyName) {
      return org.proxies.getPolicyForRevision({name, revision, policy:policyName})
        .then((d) => (isMatch(d)) ? policyName : null);
    }

    function processPolicies(policyNames) {
      return policyNames.reduce(lib.makeReducer(onePolicy), Promise.resolve([]))
        .then ( (matched) => {
          matched = matched.filter( item => !!item );
          return (matched.length === 0) ? null :
            {name, revision, policies:matched, scan:'policy type name \'' + policyType + '\''};
        });
    }

    // if (verboseOut) {
    //   verboseOut('looking at:' + name + ' r' + revision);
    // }
    return org.proxies.getPoliciesForRevision({name,revision})
      .then(processPolicies);
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_NAME,
  type : 'revision',
  description : 'flags each revision with a policy of a particular type (RaiseFault, GenerateJWT, etc)',
  getScanner : getRevisionScanner
};
