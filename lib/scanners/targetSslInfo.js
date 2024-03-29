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
      SCAN_NAME = 'targetsslhygiene';

/*
* Accepts org, an arg that is ignored, and a verboseOut
* function.  Returns a function that accepts (name,revision) and scans the proxy
* revision for a target httpConnection with SSLInfo disabled, or with
* no TrustStore.
**/
function getRevisionScanner(_org, _notUSED, _verboseOut) {

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
              htcElts = xpath.select(`/TargetEndpoint/HTTPTargetConnection`, element);
        if (htcElts.length == 0) return null;
        if (htcElts.length>1) {
          return { name, message:'Too many HTTPTargetConnection elements' };
        }

        const sslInfos = xpath.select(`SSLInfo`, htcElts[0]);
        if (sslInfos.length == 0) {
          return {name, message:'Missing SSLInfo configuration'};
        }
        if (sslInfos.length != 1) {
          return {name, message:'Incorrect SSLInfo configuration'};
        }
        const sslInfo = sslInfos[0];
        let elts = xpath.select(`Enabled`, sslInfo);
        const enabled = elts &&
                  elts[0] &&
                  elts[0].childNodes && elts[0].childNodes[0] &&
                  elts[0].childNodes[0] == 'true';
        if ( ! enabled) {
          return {name, message:'SSLInfo configuration is not Enabled'};
        }
        elts = xpath.select(`IgnoreValidationErrors`, sslInfo);
        const ignoreErrors = elts && elts[0] && elts[0].childNodes && elts[0].childNodes[0] &&
          elts[0].childNodes[0] == 'true';
        if (ignoreErrors) {
          return {name, message:'SSLInfo configuration includes IgnoreValidationErrors = true'};
        }
        return null;
      });

    const matched = check.filter( item => !!item );
    return Promise.resolve((matched.length === 0) ? null :
                           {name, revision, targets:matched, scan:'HTTPTargetConnection with incorrect SSLInfo'});
  }

  return scanRevision;
}


module.exports = {
  option : SCAN_NAME,
  type : 'revision',
  noarg : true,
  description : 'proxy with an http target with TLS disabled or no Truststore',
  getScanner : getRevisionScanner

};
