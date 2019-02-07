// index.js
// ------------------------------------------------------------------

/* jshint esversion: 6, node: true */
/* global process, console, Buffer */

'use strict';
const fs = require('fs'),
      path = require('path');

/*
* load scanners dynamically.
*/
function loadScanners() {
  var scanners = [];
  function handleError(e) {
    if (e) {
      console.log(e.stack);
      console.log('Cannot stat path %s\n', path);
      process.exit(1);
    }
  }

  function loadAll(fspath) {
    try {
      var stat = fs.statSync(fspath);
      if (stat.isDirectory()) {
        fs.readdirSync(fspath)
          .forEach( (filename) => loadAll(path.join(fspath, filename)));
      }
      else if ( stat.isFile() && fspath.endsWith('.js')) {
        let s = require(fspath);
        if (!(s.option && s.description && s.type && s.getScanner)) {
          throw new Error('invalid scanner');
        }
        let scriptName = path.basename(fspath, '.js');
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
  //eachSeries,
  makeReducer,
  loadScanners
};
