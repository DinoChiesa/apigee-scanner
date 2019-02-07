/* jshint esversion: 6, node: true */

'use strict';
const lib = require('../index.js'),
      SCAN_NAME = 'vhost';

/*
* Accepts org, and a vhostName.
* Returns a function that accepts (name,revision) and scans the proxy revision
* for a proxy endpoint that listens on a vhost of the specified name.
**/
function getRevisionScanner(org, vhostName, verboseOut) {

  let isMatch = (endpointResult) =>
    endpointResult.connection.virtualHost.indexOf(vhostName) >= 0;

  function scanRevision({name, revision}) {

    function oneEndpoint(endpoint) {
      return org.proxies.getEndpoint({name, revision, endpoint})
        .then((e) => (isMatch(e)) ? endpoint: null);
    }

    function processEndpoints(endpoints) {
      return endpoints.reduce(lib.makeReducer(oneEndpoint), Promise.resolve([]))
        .then( matched => {
          matched = matched.filter( item => !!item );
          return (matched.length === 0) ? null :
            {name, revision, endpoints:matched, scan:'vhost match \'' + vhostName + '\''};
        });
    }

    // if (verboseOut) {
    //   verboseOut('looking at:' + name + ' r' + revision);
    // }

    return org.proxies.getProxyEndpoints({name,revision})
      .then(processEndpoints);
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_NAME,
  type : 'revision',
  description : 'proxy revision with a reference to a particular vhost',
  getScanner : getRevisionScanner
};
