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
      path = require('path');

/*
* load scanners dynamically.
*/
function loadScanners() {
  let scanners = [];

  function loadAll(fspath) {
    try {
      const stat = fs.statSync(fspath);
      if (stat.isDirectory()) {
        fs.readdirSync(fspath)
          .forEach( (filename) => loadAll(path.join(fspath, filename)));
      }
      else if ( stat.isFile() && !fspath.startsWith('#') && fspath.endsWith('.js')) {
        let s = require(fspath);
        if (!(s.option && s.description && s.type && s.getScanner)) {
          throw new Error('invalid scanner');
        }
        //let scriptName = path.basename(fspath, '.js');
        scanners.push(s);
      }
    }
    catch(e) {
      console.log('error loading scanners...');
      console.log(e.stack);
      process.exit(1);
    }
  }

  var DIR = path.join(__dirname, 'scanners');
  loadAll(DIR);
  scanners.sort( (a, b) => a.option.localeCompare(b.option) );
  return scanners;
}


// /*
// * General-purpose function to reduce an array with an
// * iterator function.
// **/
// function eachSeries(arr, iteratorFn, initial) {
//   let reducer = function(p, item){
//         return p.then( (interim) => {
//           return iteratorFn(item, interim);
//         });
//       };
//   return arr.reduce( reducer, Promise.resolve(initial || []));
// }


// Produce a reducer fn from a Fn returning a promise. This
// allows the fn to be applied across an array of items with
// Array.reduce(), and the results get accumulated into an
// array.
//
// The calling pattern is:
//
//  items.reduce(makeReducer(funcReturningPromise), Promise.resolve([]));
//
function makeReducer(funcReturningPromise) {
  //var count = 0;
  return function(p, item) {
    return p.then( (arrayAccumulator) => {
      return funcReturningPromise(item)
        .then( x => {
          //count++;
          //console.log('fired %d', count);
          arrayAccumulator.push(x);
          return arrayAccumulator; // consumed by the next promise
        });
    });
  };
}

module.exports = {
  makeReducer,
  loadScanners
};
