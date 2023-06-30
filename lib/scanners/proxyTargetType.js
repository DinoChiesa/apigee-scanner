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
      SCAN_NAME = 'targettype';

function getTargetTypeName(t) {
  if (t === 'hosted') return 'HostedTarget';
  if (t === 'http') return 'HttpTargetConnection';
  if (t === 'local') return 'LocalTargetConnection';
  if (t === 'node') return 'ScriptConnection';
  if (t === 'none') return 'irrelevant';
  return null;
}

/*
* Accepts org, an targetType (node, hosted, http, local), and a verboseOut
* function.  Returns a function that accepts (name,revision,bundleDir) and scans the proxy
* revision for a target endpoint of the specified type.
**/
function getRevisionScanner(_org, targetType, _verboseOut) {

  const targetEltName = getTargetTypeName(targetType);
  if ( ! targetEltName) {
    throw new Error(`unsupported targetType: ${targetType}`);
  }

  function scanRevision({name, revision, bundleDir}) {
    const targetsDir = path.join(bundleDir, 'apiproxy', 'targets'),
          dirExists = fs.existsSync(targetsDir),
          targets = dirExists ? fs.readdirSync(targetsDir) : [];
    if ((targetType == 'none') && ( ! targets || targets.length == 0)) {
      return Promise.resolve({name, revision, targets:[], scan:'no target'});
    }

    const check = targets
      .map(item => {
        const targetFilePath = path.join(targetsDir, item),
              element = new Dom().parseFromString(
                fs.readFileSync(targetFilePath).toString()
              ),
              elts = xpath.select(`/TargetEndpoint/${targetEltName}`, element),
              matches = elts && elts.filter( elt => elt.tagName);
        return (matches && matches.length) ? item : null;
      });

    const matched = check.filter( item => !!item );
    return Promise.resolve((matched.length === 0) ? null :
                           {name, revision, targets:matched, scan:'target type ' + getTargetTypeName(targetType)});
  }

  return scanRevision;
}

module.exports = {
  option : SCAN_NAME,
  type : 'revision',
  noarg : false,
  description : 'proxy with a specified target type (hosted, http, local, script), or none',
  getScanner : getRevisionScanner
};
