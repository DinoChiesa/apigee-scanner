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

  function onePolicy(name, revision) {
    return (policyName, accumulator) => {
      let processPolicy = (policyDetails) =>
        (isMatch(policyDetails)) ? accumulator.concat(policyName) : accumulator;

      return org.proxies.getPolicyForRevision({name, revision, policy:policyName})
        .then(processPolicy);
    };
  }

  function scanRevision(name, revision) {
    async function processPolicies(policyNames) {

      let policies = await lib.eachSeries(policyNames, onePolicy(name, revision));
      if (policies.length === 0) {
        return null;
      }

      return {name, revision, policies, message:'policy type name \'' + policyType + '\''};
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
