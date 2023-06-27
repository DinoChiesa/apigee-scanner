// Copyright © 2017-2023 Google LLC.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

const fs = require('fs'),
      path = require('path'),
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
