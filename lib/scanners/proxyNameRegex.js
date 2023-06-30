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

const SCAN_NAME = 'proxyname';

/*
* Accepts org, regex, and a verboseOut function. Returns a
* function that accepts (proxyDefn) and matches the name against
* the regex.
**/
function getProxyScanner(_org, regex, _verboseOut) {
  const re1 = new RegExp(regex);

  return (proxyDefn) =>
    //console.log('** scanProxyName() examining: %s', proxyDefn.name);
    // This use of promise is not really needed; it's a synchronous check.
    // But in general the model allows async scans, so each
    // scanner must return a Promise.
    Promise.resolve(re1.exec(proxyDefn.name) ? { name: proxyDefn.name, scan: `proxyname match '${regex}'`} : null);

}


module.exports = {
  option : SCAN_NAME,
  type : 'proxy',
  description : 'proxy name matching a regex',
  getScanner : getProxyScanner
};
