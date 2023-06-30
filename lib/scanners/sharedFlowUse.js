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
      SCAN_OPTION = 'sharedflowuse';

/*
* Accepts org, and a sharedFlowName, which can be a regular string or
* a regex, denoted by leading and trailing /. Returns a
* function that accepts {(name,revision,bundleDir)} and scans the exploded
* bundle for a FlowCallout policy to a sharedflow that matches: if name, exact
* match; if regex, regex match.
**/
function getRevisionScanner(org, sharedFlowName, verboseOut) {
  //console.log(`policyType.revisionScanner(): ${policyType}`);
  const isRegex = s => (s && s.startsWith('/') && s.endsWith('/'));

  const isMatch = (function (){
        if (isRegex(sharedFlowName)) {
          const regex = new RegExp(sharedFlowName.slice(1, -1));
          return (t) => t.match(regex);
        }
        // just a string match
        return (t) => (t == sharedFlowName);
      }());

  function scanRevision({name, revision, bundleDir}) {
    //console.log('bundleDir: ' + bundleDir);
    const policiesDir = path.join(bundleDir, 'apiproxy', 'policies'),
          dirExists = fs.existsSync(policiesDir),
          policies = dirExists ? fs.readdirSync(policiesDir) : [];

    const check = policies
      .map(item => {
        const policyFilePath = path.join(policiesDir, item),
              element = new Dom().parseFromString(
                fs.readFileSync(policyFilePath).toString()
              ),
              doc = xpath.select("/", element);

        if ( ! doc || !doc[0] || !doc[0].documentElement) {
          return null;
        }
        const policyType = doc[0].documentElement.tagName || "";
        if (policyType == 'FlowCallout') {
          const targetSharedFlow = xpath.select("/FlowCallout/SharedFlowBundle/text()",
                                              doc[0].documentElement);
          return isMatch(targetSharedFlow) ? item : null;
        }
        return null;
      });

    const matched = check.filter(item => !!item),
          scanLabel = isRegex(sharedFlowName) ?
      `use of sharedflow matching pattern '${sharedFlowName}'` :
      `use of sharedflow named '${sharedFlowName}'`;

    return Promise.resolve((matched.length === 0) ? null :
                           {name, revision, policies:matched, scan:scanLabel});
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_OPTION,
  type : 'revision',
  description : 'flags each revision that has a FlowCallout to a named SharedFlow, or a SharedFlow that matches a regex',
  getScanner : getRevisionScanner
};
