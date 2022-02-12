/* jshint esversion: 6, node: true */

'use strict';
const lib = require('../index.js'),
      path = require('path'),
      fs = require('fs'),
      Dom = require("@xmldom/xmldom").DOMParser,
      xpath = require("xpath"),
      SCAN_NAME = 'vhost';

/*
* Accepts org, and a vhostName.
* Returns a function that accepts (name,revision,bundleDir) and scans the proxy revision
* for a proxy endpoint that is configured with a vhost of the specified name.
**/
function getRevisionScanner(org, vhostName, verboseOut) {

  function scanRevision({name, revision, bundleDir}) {
    let proxyEndpointsDir = path.join(bundleDir, 'apiproxy', 'proxies');
    let dirExists = fs.existsSync(proxyEndpointsDir);
    let proxies = dirExists ? fs.readdirSync(proxyEndpointsDir) : [];

    let check = proxies
      .map(item => {
        let endpointFilePath = path.join(proxyEndpointsDir, item);
        let element = new Dom().parseFromString(
              fs.readFileSync(endpointFilePath).toString()
            );
        let vhostElts = xpath.select(`/ProxyEndpoint/HTTPProxyConnection/VirtualHost`, element);
        let matches = vhostElts &&
          vhostElts.filter( elt => elt.childNodes && elt.childNodes[0] && elt.childNodes[0].nodeValue == vhostName);
        return (matches && matches.length) ? item : null;
      });

    let matched = check.filter( item => !!item );
    return Promise.resolve((matched.length === 0) ? null :
                           {name, revision, targets:matched, scan:`vhost match '${vhostName}'`});
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_NAME,
  type : 'revision',
  description : 'proxy revision with a reference to a particular vhost',
  getScanner : getRevisionScanner
};
