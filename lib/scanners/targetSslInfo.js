/* jshint esversion: 6, node: true */

'use strict';

const lib = require('../index.js'),
      SCAN_NAME = 'targetssl';

/*
* Accepts org, an arg that is ignored, and a verboseOut
* function.  Returns a function that accepts (name,revision) and scans the proxy
* revision for a target httpConnection with SSLInfo disabled, or with
* no TrustStore.
**/
function getRevisionScanner(org, targetType, verboseOut) {

  let isMatch = (t) =>
    (t.connection.connectionType == 'httpConnection' &&
     ( ! t.connection.sSLInfo || ! t.connection.sSLInfo.enabled));

  function oneTarget(name, revision) {
    return (target, accumulator) => {
      let processTarget = (targetResult) =>
        (isMatch(targetResult)) ? accumulator.concat(target) : accumulator;

      return org.proxies.getTarget({name, revision, target})
        .then(processTarget);
    };
  }

  function scanRevision(name, revision) {
    async function processTargets(targets) {

      let targetResult = await lib.eachSeries(targets, oneTarget(name, revision));
      if (targetResult.length === 0) {
        return null;
      }
      //console.log('targetResult: ' + JSON.stringify(targetResult));
      return {name, revision, targets:targetResult, message:'http target with incorrect SSLInfo'};
    }
    return org.proxies.getTargets({name,revision})
      .then(processTargets);
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_NAME,
  type : 'revision',
  noarg : true,
  description : 'proxy with an http target with TLS disabled or no Truststore',
  getScanner : getRevisionScanner

};
