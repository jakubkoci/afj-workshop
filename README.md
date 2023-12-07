AFJ docs

https://aries.js.org/guides/0.4

Generate seed (32 characters string)

```sh
node
> let crypto = require('crypto')
> crypto.randomBytes(16).toString('hex')
```

Blockchain to register DID

http://test.bcovrin.vonx.io/

```
yarn start-alice
```

Wait for "Agent started." log message.

```
yarn start-bob
```

Remove local data

```
rm -rf ~/.afj/data/wallet/alice && rm -rf /.afj/data/wallet/bob
```
