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
      SCAN_OPTION = 'policyunattached';

const getDomElement = filePath => new Dom().parseFromString(fs.readFileSync(filePath).toString() );

const xpathFind = (lookingFor) =>
(elt, subpath) => xpath.select(subpath, elt) .map(x => x.data) .indexOf(lookingFor) >=0 ;

const endpointChecker = (bundleDir, subdir, endpointType) => {
        const endpointsDir = path.join(bundleDir, 'apiproxy', subdir),
              dirExists = fs.existsSync(endpointsDir),
              endpointFiles = (dirExists ? fs.readdirSync(endpointsDir) : [])
                 .filter( name => name && name.endsWith('.xml'));

        // optimize when there are no endpoints
        if (endpointFiles.length == 0) {
          return (_lookingFor) => false;
        }

        function isAttached(lookingFor) {
          return endpointFiles
            .map(item => {
              const domElement = getDomElement(path.join(endpointsDir, item)),
                    p = ["/Flows/Flow", "/PreFlow", "/PostFlow", "/PostClientFlow" ]
                        .map(x => `/${endpointType}${x}`).join('|'),
                    finder = xpathFind(lookingFor),
                    attached = xpath.select(p, domElement)
                        .find(elt => finder(elt, "(Request|Response)/Step/Name/text()"));

              if ( !attached ) {
                const p = ["/DefaultFaultRule", "/FaultRules/FaultRule" ]
                  .map(x => `/${endpointType}${x}`).join('|');
                attached = xpath.select(p, domElement).find(elt => finder(elt, "Step/Name/text()"));
              }

              return attached;
            })
            .reduce( (a,item) => a || item, false);
        }
        return isAttached;
      };

/*
* Accepts two ignored params and a verboseOut function. Returns a function that accepts
* {(name,revision,bundleDir)} and scans the exploded bundle for any policies
* that are not attached to any flow in the bundle.
**/
function getRevisionScanner(_IGNORED1, _IGNORED2, _verboseOut) {

  function scanRevision({name, revision, bundleDir}) {
    let policiesDir = path.join(bundleDir, 'apiproxy', 'policies');
    let dirExists = fs.existsSync(policiesDir);
    let policies = dirExists ? fs.readdirSync(policiesDir) : [];
    let policyNames = policies
      .map(item => {
        let element = getDomElement(path.join(policiesDir, item));
        let nameAttr = xpath.select("/*/@name", element);
        return (nameAttr && nameAttr[0] && nameAttr[0].value);
      })
      .filter(item => !!item);

    let pChecker = endpointChecker(bundleDir, 'proxies', 'ProxyEndpoint');
    let tChecker = endpointChecker(bundleDir, 'targets', 'TargetEndpoint');
    let unattached = policyNames.filter(lookingFor =>
                                        !pChecker(lookingFor) && !tChecker(lookingFor));

    return Promise.resolve((unattached.length === 0) ? null :
                           {name, revision, policies:unattached, scan:'unattached policies'});
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_OPTION,
  noarg : true,
  type : 'revision',
  description : 'flags each revision with a policy that is unattached',
  getScanner : getRevisionScanner
};
