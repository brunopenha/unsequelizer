## Code-gen

Converts SQL Script (currently only SQL Server) to entities.  

> Generates Java, C#, JavaScript (ECMA6) and Go Lang code.

### How to
```sh
npm i
node code-gen.js <sqlscript.sql> <entities package/namespace> <repositories package/namespace>
```
  
**Example:**
```sh
npm i
node code-gen.js create-tables.sql com.github.notanyfoolstools.unsequelizer.models com.github.notanyfoolstools.unsequelizer.repositories
```
