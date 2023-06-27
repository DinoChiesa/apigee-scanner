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

const SCAN_NAME = 'proxydesc';

/*
* Accepts org, and a regex, and a verboseOut fn.
* Returns a function that accepts (name,revision) and scans the proxy revision
* for a description that matches the regex.
**/
function getRevisionScanner(org, regex, verboseOut) {
  let re1 = new RegExp(regex);

  function scanRevision({name, revision}) {
    function processProxyDefn(proxyDefn) {
      let match = re1.exec(proxyDefn.description);
      let result = (match) ? {
            name: proxyDefn.name,
            revision: proxyDefn.revision,
            scan: "description match '" + regex + "'"} : null;
      return result;
    }
    // if (verboseOut) {
    //   verboseOut('looking at:' + name + ' r' + revision);
    // }
    return org.proxies.get({name,revision})
      .then(processProxyDefn);
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_NAME,
  type : 'revision',
  description : 'proxy description matching a particular regex',
  getScanner : getRevisionScanner
};
