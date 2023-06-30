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
      SCAN_NAME = 'targetloadbalancer';

/*
* Accepts org, an optional serverName, and a verboseOut function.  Returns a
* function that accepts (name,revision) and scans the proxy revision for a
* target that uses httpConnection with a loadbalancer, optionally with a
* particular server name.
*
**/
function getRevisionScanner(_org, serverName, _verboseOut) {
  const isRegex = (serverName && serverName.startsWith('/') && serverName.endsWith('/'));

  // returns message
  const checkit = (serverName == 'any') ?
        (_lb) => 'uses LoadBalancer' :
        (lb) => {
          const isMatch = (function (){
                if (isRegex)  {
                  const regex = new RegExp(serverName.slice(1, -1));
                  return (t) => t.match(regex);
                }
                // just a string match
                return (t) => (t == serverName);
            }());

          const servers = xpath.select(`Server`, lb);
          if (servers.length == 0) {
            return 'LoadBalancer missing Server elements';
          }
          if (servers.find( s => isMatch(xpath.select(`@name`, s)[0].value))) {
            return isRegex ?
              `LoadBalancer references a Server matching ${serverName}` :
              `LoadBalancer references Server ${serverName}`;
          }
          return null;
        };

  function scanRevision({name, revision, bundleDir}) {
    const targetsDir = path.join(bundleDir, 'apiproxy', 'targets'),
          dirExists = fs.existsSync(targetsDir),
          targets = dirExists ? fs.readdirSync(targetsDir) : [];

    const check = targets
      .map(name => {
        const targetFilePath = path.join(targetsDir, name),
              element = new Dom().parseFromString(
                fs.readFileSync(targetFilePath).toString()
              ),
              lbElts = xpath.select(`/TargetEndpoint/HTTPTargetConnection/LoadBalancer`, element);
        if (lbElts.length == 0) return null;
        if (lbElts.length>1) {
          return { name, message:'Too many HTTPTargetConnection elements' };
        }
        const message = checkit(lbElts[0]);
        return (message) ? {name, message} : null;
      });

    const matched = check.filter( item => !!item );
    return Promise.resolve((matched.length === 0) ? null :
                           {name, revision, targets:matched, scan:'HTTPTargetConnection with LoadBalancer'});
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_NAME,
  type : 'revision',
  description : 'proxy with a target LoadBalancer of a particular name, or with name matching a pattern',
  getScanner : getRevisionScanner
};
