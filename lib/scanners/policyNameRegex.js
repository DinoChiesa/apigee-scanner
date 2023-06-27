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
      SCAN_NAME = 'policyname';

/*
* Accepts org, and a regex (Eg, ^AM-.*). Returns a function that accepts
* {(name,revision,bundleDir)} and scans the exploded bundle for the proxy
* revision for a policy with a name that matches the given regex.
**/
function getRevisionScanner(org, regex, verboseOut) {
  let re1 = new RegExp(regex);
  let isMatch = (t) => (t.match(re1));

  function scanRevision({name, revision, bundleDir}) {
    let policiesDir = path.join(bundleDir, 'apiproxy', 'policies');
    let dirExists = fs.existsSync(policiesDir);
    let policies = dirExists ? fs.readdirSync(policiesDir) : [];
    let check = policies
      .map(item => {
        let policyFilePath = path.join(policiesDir, item);
        let element = new Dom().parseFromString(
              fs.readFileSync(policyFilePath).toString()
            );
        let nameAttr = xpath.select("/*/@name", element);
        let policyName =
          (nameAttr &&
           nameAttr[0] &&
           nameAttr[0].value) ||
          "";
        return isMatch(policyName) ? item : null;
      });

    let matched = check.filter(item => !!item);
    return Promise.resolve((matched.length === 0) ? null :
                           {name, revision, policies:matched, scan:'policy name regex \'' + regex + '\''});
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_NAME,
  type : 'revision',
  description : 'flags each revision with a policy with a name that matches a pattern',
  getScanner : getRevisionScanner
};
