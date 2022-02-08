# Scanner Plugins

Plugins must export an object with 4 properties.
```
module.exports = {
  option : 'vhost'
  type : 'revision',
  description : 'scans revisions for references to a particular vhost',
  noarg : true,
  getScanner : getRevisionScanner
};
```

| *prop*      | *description*    |
|-------------|------------------|
| option      | required. the command-line option |
| noarg       | optional. true => this option accepts no argument. |
| type        | required. either 'proxy' or 'revision' |
| description | required. obvious |
| getScanner  | required. a function. |

Specify the noarg as true if the command-line option accepts no argument.

The getScanner() input args are `(org, arg, verboseOut)` .

* *org* is an apigee-edge-js org object, and it allows the
  scanner to query the org more deeply.
* arg is the argument passed with the command-line option. Its meaning varies with the plugin.
* verboseOut is either null, or a function that will emit output.

`getScanner` must return a function which accepts different args depending on type.

* If type == revision, input args are `(proxyname, revision, bundleDir)`
  The `bundleDir` is a string containing the directory containing the expanded
  zip bundle for the given proxy revision. The function can then examine
  the files in the bundle as appropriate.

* If type == proxy,  input args are `(proxyDefn)`, which looks like:
  ```
  {
      "metaData": {
          "createdAt": 1544059735857,
          "createdBy": "dchiesa@google.com",
          "lastModifiedAt": 1544059735857,
          "lastModifiedBy": "dchiesa@google.com",
          "subType": "null"
      },
      "name": "apigee-proxy-name"
      "revision": [
          "1"
      ]
  }
  ```


The return type of this scanner fn is a Promise or a plain value.
