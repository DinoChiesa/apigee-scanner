# Scan Apigee Proxies

This tool scans Apigee proxies for various conditions, for example, proxies with a name
that matches a regular expression. The tool then reports out the name of the
matching proxies. It works with Apigee Edge, or Apigee X, or Apigee hybrid.

The conditions can be somewhat elaborate. This can be helpful in enforcing compliance rules: eg,
- proxies must have a name that conforms to a specific pattern
- proxies must listen on a specific vhost, or must not listen on the the 'default' (insecure) vhost
- proxies must not use specific policy types, etc.
- proxies must have an explicit SSLInfo configured on the HTTPTargetConnection, and must not have SSL disabled
- etc

The output of this tool may be used for further investigation or reports out to
team collaboration systems, like Slack or Google chat, etc.

## License and Copyright

This material is [Copyright (c) 2018-2023 Google LLC](./NOTICE).
and is licensed under the [Apache 2.0 License](LICENSE).

## Disclaimer

This tool is open-source software. It is not an officially supported Google
product. It is not a part of Apigee, or any other officially supported Google
Product.

## Pre-requisites

* Node v16.13.1 or above
* npm

## Don't forget to Install node modules

```
npm install
```

## Getting Help

Invoke the tool with `--help` to get help:
```
$ node ./scanProxies.js --help
Usage:
  node scanProxies.js [OPTION]

Options:
  -M, --mgmtserver=ARG         the base path, including optional port, of the Apigee mgmt server. Defaults to https://api.enterprise.apigee.com .
  -u, --username=ARG           org user with permissions to read Apigee configuration.
  -p, --password=ARG           password for the org user.
  -n, --netrc                  retrieve the username + password from the .netrc file. In lieu of -u/-p
  -o, --org=ARG                the Apigee organization.
  -Z, --ssoZone=ARG            specify the SSO zone to use when authenticating.
      --ssoUrl=ARG             specify the SSO url to use when authenticating.
  -C, --passcode=ARG           specify the passcode to use when authenticating.
  -J, --keyfile=ARG            the keyfile for a service account, for use with apigee.googleapis.com.
      --token=ARG              use this explicitly-provided oauth token.
      --apigeex                use apigee.googleapis.com for the mgmtserver.
  -T, --notoken                do not try to obtain an oauth token.
  -N, --forcenew               force obtain a new oauth token.
  -v, --verbose
  -h, --help
  -q, --quiet                  Optional. be quiet.
  -d, --deployed               Optional. restrict the scan to revisions of proxies that are deployed.
  -L, --list                   Optional. list the available scanners.
  -e, --environment=ARG        Optional. Use with the --deployed flag.
      --latestrevision         Optional. scan only the latest revision of each proxy.
      --namepattern=ARG        Optional. scan only proxies with a name matching the regex.
      --policyname=ARG         flags each revision with a policy with a name that matches a pattern
      --policytype=ARG         flags each revision with a policy of a particular type (RaiseFault, GenerateJWT, etc), or a type that matches a regex
      --policyunattached       flags each revision with a policy that is unattached
      --proxydesc=ARG          proxy description matching a particular regex
      --proxyname=ARG          proxy name matching a regex
      --revisioncount=ARG      flags each proxy with a number of revisions greater than x
      --sharedflowuse=ARG      flags each revision that has a FlowCallout to a named SharedFlow, or a SharedFlow that matches a regex
      --targetloadbalancer=ARG proxy with an target LoadBalance
      --targetsslhygiene       proxy with an http target with TLS disabled or no Truststore
      --targettype=ARG         proxy with a specified target type (hosted, http, local, script), or none
      --vhost=ARG              proxy revision with a reference to a particular vhost
```

## Example Usage with Apigee X or hybrid

If you are accessing Apigee X or hybrid, you can authenticate this way:
```sh
PROJECT_ID=$ORG
gcloud config set core/project $PROJECT_ID
TOKEN=$(gcloud auth print-access-token)
node ./scanProxies.js -v --apigeex --token $TOKEN -o $ORG  --policytype GenerateJWT
```

This requires that you have previously installed the [Google Cloud SDK](https://cloud.google.com/sdk) with the [gcloud](https://cloud.google.com/cli) command line tool.

## Example Usage with Apigee Edge

After you install the node modules you can run the tool:

```
node ./scanProxies.js -o $ORG -n -v  --policytype GenerateJWT
```

The `-n` option tells the tool to retrieve the username and password from the ~/.netrc file. If you use the `-n` option, that .netrc file should have a stanza like this:
```
machine api.enterprise.apigee.com
  login myusername@email.com
  password VerySecret!
```

This works with Apigee Edge. This .netrc-based authentication won't work with Apigee X or hybrid.

Other options for authenticating:
* specify the -u and -p options on the command line
* specify the -u option and be prompted for the password
* if you use MFA, SAML, or otherwise are unable to use basic authentication, then pass a PASSCODE on the command line with the -C option in lieu of the password.  Obtain the passcode from https://login.apigee.com/passcode . Note: this works only with Apigee Edge.



## Example output

Regardless whether you use Edge or X/hybrid, the output is something like this:

```
[
  {
    "name": "sujnana-jwt-1",
    "revision": "11",
    "policies": [
      "GenerateJWT-1",
      "GenerateJWT-2",
      "GenerateJWT-3"
    ],
    "message": "policy type name 'GenerateJWT'"
  },
  {
    "name": "jwt-generate",
    "revision": "6",
    "policies": [
      "Generate-JWT-HS256-Basic",
      "Generate-JWT-RS256-AdditionalClaims",
      "Generate-JWT-RS256-Basic"
    ],
    "message": "policy type name 'GenerateJWT'"
  }
]
```

## Notes on Operation

The way the tool works is to export the API proxies via the Apigee API, and then examine the exploded proxy bundles.
The tool uses a temporary directory to hold the expanded bundles.


## Available Scanners

```
Scanners:
  --policyname ARG         flags each revision with a policy with a name that matches a pattern
  --policytype ARG         flags each revision with a policy of a particular type (RaiseFault, GenerateJWT, etc), or a type that matches a regex
  --policyunattached       flags each revision with a policy that is unattached
  --proxydesc ARG          proxy description matching a particular regex
  --proxyname ARG          proxy name matching a regex
  --revisioncount ARG      flags each proxy with a number of revisions greater than x
  --sharedflowuse ARG      flags each revision that has a FlowCallout to a named SharedFlow, or a SharedFlow that matches a regex
  --targetloadbalancer ARG proxy with an target LoadBalance
  --targetsslhygiene       proxy with an http target with TLS disabled or no Truststore
  --targettype ARG         proxy with a specified target type (hosted, http, local, script), or none
  --vhost ARG              proxy revision with a reference to a particular vhost
```

Find the scanners in [lib/scanners](./lib/scanners).

List them at runtime with the `--list` option:

```
node ./scanProxies.js --list
```


## Scanning only Deployed Proxies

Use the `--deployed` option to tell the tool to examine only proxy revisions that are deployed.  In a large organization with many revisions of lots of proxies, this can save lots of time.

```
node ./scanProxies.js -o $ORG -n -v --deployed  --proxydesc '^((?!@example.com).)*$'
```


## Scanning only the latest revision

Use the `--latestrevision` option to tell the tool to examine only the latest
revision of each proxy, regardless whether it is deployed or not.  In a large
organization with many revisions of lots of proxies, this can save lots of time.

```
node ./scanProxies.js -o $ORG -n -v --latestrevision  --proxydesc '^((?!@example.com).)*$'
```


## Combining Criteria

You can use more than one of the scanners in a single run, like this:

```
node ./scanProxies.js -o $ORG -n -v --deployed --proxydesc '^((?!@example.com).)*$'  --policytype XMLToJSON
```

The result is the set of proxies which is the _union_ of all that have matched
for each option. In other words, the matches satisfy either or both of the scan
tests. (Boolean OR)

At this time, it is not possible to return a set of proxies that matches the _intersection_ of
two different scans. (Boolean AND)

## The PolicyType scanner

You can pass a name or a regular expression to the policytype scanner.

For example this will scan an Apigee-X organization to find all proxies with a VerifyAPIKey policy:

```
TOKEN=$(gcloud auth print-access-token)
node ./scanProxies.js --token $TOKEN --apigeex -o $ORG --latestrevision --policytype VerifyAPIKey
```

You can denote a regex using leading and trailing slashes. This will scan the
same org, checking for _either_ VerifyAPIKey or Quota:

```
node ./scanProxies.js --token $TOKEN --apigeex -o $ORG --latestrevision --policytype "/(VerifyAPIKey|Quota)/"
```

And you can use "negative lookahead" (a regex feature) to scan for policies that
ARE NOT one of a subset. For example, check for any proxy that uses any policy
_OTHER THAN_ VerifyAPIKey, Quota, or OAuthV2:

```
node ./scanProxies.js --token $TOKEN --apigeex -o $ORG --latestrevision --policytype "/^(?!(Quota|VerifyAPIKey|OAuthV2)).+$/"
```


## More Specific Usage Examples

1. Find deployed proxies with names that don't look like foo-1 or bar-2:

   ```
   node ./scanProxies.js -o $ORG -n -v --deployed  --proxyname '^(?!((foo|bar)-(/d)))'
   ```

2. Find deployed proxies that use the XMLToJSON policy:

   ```
   node ./scanProxies.js -o $ORG -n -v --deployed  --policytype XMLToJSON
   ```

3. Find deployed proxies that do not include an email address in the description.
   ```
   node ./scanProxies.js -o $ORG -n -v --deployed  --proxydesc '^((?!@example.com).)*$'
   ```

4. Find deployed proxies that listen on the default vhost:
   ```
   node ./scanProxies.js -o $ORG -n -v --deployed  --vhost default
   ```

5. Find deployed proxies that have TLS configured incorrectly on any target:
   ```
   node ./scanProxies.js -o $ORG -n -v --deployed  --targetssl
   ```

6. Find deployed proxies that use a script (trireme nodejs) target:
   ```
   node ./scanProxies.js -o $ORG -n -v --deployed  --targettype script
   ```

7. Scan for proxies that contain a policy with a name matching a specific pattern:

   ```sh
   node ./scanProxies.js -v --apigeex --token $TOKEN -o $ORG  --policyname '^AM-.*'
   ```

7. Scan for proxies that are not attached to any Flow or FaultRule:

   ```sh
   node ./scanProxies.js -v --apigeex --token $TOKEN -o $ORG  --policyunattached
   ```


7. Scan for proxies (checking only the latest revision of each) that explicitly call to a specific SharedFlow:

   ```sh
   node ./scanProxies.js --token $TOKEN --apigeex --org $ORG --latestrevision --sharedflowuse common-config
   ```
   Note: this does not catch indirect calls to the sharedflow, eg, from another sharedflow!


## Adding Scanners

It's pretty straightforward to add more scanners.
Just add a new .js file to the [scanners](./lib/scanners) directory.
Follow the example in the existing scanners. Use a unique SCAN_NAME, which
represents the command-line option for that scanner. The scan tool will invoke
the scanner if the command-line option for that scanner is present.


## Possible Future Enhancements

?? more scanners.


## Support

If you need assistance, you can try inquiring on [Google Cloud Community
forum dedicated to Apigee](https://www.googlecloudcommunity.com/gc/Apigee/bd-p/cloud-apigee).
There is no service-level guarantee for
responses to inquiries regarding this tool.

## Bugs

None?
