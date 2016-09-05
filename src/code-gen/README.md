## Code-gen

Converts SQL Script (currently only SQL Server) to entities.  

> Generates Java, C#, JavaScript (ECMA6) and Go Lang code.

### How to

**1. Generate aggregation definitions file (replace "sqlscript.sql" and "definitions.txt"):**
```sh
npm i
node code-gen.js dumpdefs sqlscript.sql definitions.txt
```

**2. Edit your definitions file.**

**3. Generate code (replace "sqlscript.sql" and "definitions.txt"):**
```sh
npm i
node code-gen.js gen sqlscript.sql definitions.txt
```
