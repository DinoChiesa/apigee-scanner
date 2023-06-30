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
function getRevisionScanner(_org, vhostName, _verboseOut) {
  const isRegex = s => (s && s.startsWith('/') && s.endsWith('/'));

  const isMatch = (function (){
        if (isRegex(vhostName)) {
          const regex = new RegExp(vhostName.slice(1, -1));
          return (t) => t.match(regex);
        }
        // just a string match
        return (t) => (t == vhostName);
      }());

  function scanRevision({name, revision, bundleDir}) {
    const proxyEndpointsDir = path.join(bundleDir, 'apiproxy', 'proxies'),
          dirExists = fs.existsSync(proxyEndpointsDir),
          proxies = dirExists ? fs.readdirSync(proxyEndpointsDir) : [];

    const check = proxies
      .map(item => {
        const endpointFilePath = path.join(proxyEndpointsDir, item),
              element = new Dom().parseFromString(
                fs.readFileSync(endpointFilePath).toString()
              ),
              vhosts = xpath.select(`/ProxyEndpoint/HTTPProxyConnection/VirtualHost`, element),
              matches = vhosts &&
                  vhosts.filter( e => e.childNodes && e.childNodes[0])
                      .map( e => e.childNodes[0].nodeValue)
                      .filter( e => isMatch(e) );
        return (matches && matches.length) ? item : null;
      });

    const matched = check.filter( item => !!item );
    return Promise.resolve((matched.length === 0) ? null :
                           {name, revision, targets:matched, scan:`vhost match '${vhostName}'`});
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_NAME,
  type : 'revision',
  description : 'proxy revision with a reference to a particular vhost, or with a vhost with name matching a regex',
  getScanner : getRevisionScanner
};
