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

  function scanRevision({name, revision}) {

    function oneTarget (targetName) {
      return org.proxies.getTarget({name, revision, target:targetName})
        .then( t => (isMatch(t)) ? targetName : null);
    }

    function processTargets(targets) {
      return targets.reduce( lib.makeReducer(oneTarget), Promise.resolve([]) )
        .then ( matched => {
          matched = matched.filter( item => !!item );
          return (matched.length === 0) ? null :
            {name, revision, targets:matched, scan:'http target with incorrect SSLInfo'};
        });
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
