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

  function oneEndpoint(name, revision) {
    return (endpoint, accumulator) => {
      let processEndpoint = (endpointResult) =>
        (isMatch(endpointResult)) ? accumulator.concat(endpoint) : accumulator;

      return org.proxies.getEndpoint({name, revision, endpoint})
        .then(processEndpoint);
    };
  }

  function scanRevision(name, revision) {
    async function processEndpoints(endpoints) {

      let endptResult = await lib.eachSeries(endpoints, oneEndpoint(name, revision));
      if (endptResult.length === 0) {
        return null;
      }

      return {name, revision, endpoints:endptResult, message:'vhost match \'' + vhostName + '\''};
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
