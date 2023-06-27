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

const SCAN_NAME = 'revisioncount';

/*
* Accepts org, and a threshold. Returns a function that accepts
* {(name,revision,bundleDir)} and which compares the revision number
* to the threshold.
**/
function getProxyScanner(org, threshold, verboseOut) {

  return (proxyDefn) =>
    Promise.resolve((proxyDefn.revision.length < threshold) ? null :
                    {name: proxyDefn.name, scan:`number of revisions greater than threshold (${proxyDefn.revision.length} > ${threshold})`});
}


module.exports = {
  option : SCAN_NAME,
  type : 'proxy',
  description : 'flags each proxy with a number of revisions greater than x',
  getScanner : getProxyScanner
};
