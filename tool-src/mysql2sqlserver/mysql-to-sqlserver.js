// HACK: Rustic, bearded, angry and sweating

const fs = require('fs');

fs.readFile(process.argv[2], 'utf8', (err,data) => {
  if (err) {
    return console.log(err);
  }
  fs.writeFile(process.argv[3], convert(data), (err) => {
		if(err) {
			console.log(err);
		} else {
			console.log("\nGENERATED AND SAVED", process.argv[3], '\n');
		}
	});
});


// MAIN REFERENCE https://msdn.microsoft.com/en-us/library/hh313099(v=sql.110).aspx
// OTHER REFERENCE https://technet.microsoft.com/en-us/library/cc966396.aspx

const TYPE_CONVERSION_REFERENCE = [

  // TODO write types correctly in this dictionary  (no time now... and wtf is [*] Microsoft?)

  [/bigint(?:\(\d+\))?/, 'bigint'], // 'bigint[*..255]/, 'bigint'
  [/binary(?:\(1\))?/, 'binary[1]'], // 'binary(1)/, 'binary[1]'], 'binary/, 'binary[1]'],
  // 'binary[2..255]/, 'binary[*]'],

// TODO UNCOMMENT
  // [/bit/, 'binary[1]'],
  //
  // [/bit\([1-8]\)/, 'binary([1]'], // 'bit[0..8]/, 'binary[1]'
  // [/bit\((?:17|18|19|20|21|22|23|24)\)/, 'binary[3]'], // 'bit[17..24]/, 'binary[3]'
  // [/bit\((?:25|26|27|28|29|30|31|32)\)/, 'binary[4]'], // 'bit[25..32]/, 'binary[4]'],
  // [/bit\((?:33|34|35|36|37|38|39|40)\)/, 'binary[5]'], //  [/bit[33..40]/, 'binary[5]'],
  // [/bit\((?:41|42|43|44|45|46|47|48)\)/, 'binary[6]'], // 'bit[41..48]/, 'binary[6]'],
// UNCOMMENT-END

  // 'bit[49..56]/, 'binary[7]'],
  // 'bit[57..64]/, 'binary[8]'],
  // 'bit[57..64]/, 'binary[8]'],
  // 'bit[9..16]/, 'binary[2]'],
  // 'bit[9..16]/, 'binary[2]'],
  [/blob/, 'varbinary(max)'],
  [/blob\([0-1]\)/, 'varbinary[1]'], //  [/blob[0..1]/, 'varbinary[1]'],
  //  [/blob[2..8000]/, 'varbinary[*]'],
  // 'blob[8001..*]/, 'varbinary(max)'],
  [/bool/, 'bit'],
  [/boolean/, 'bit'],
  [/char/, 'nchar[1]'],
  [/char byte(?:\([0-1]\))?/, 'binary[1]'], // 'char byte[0..1]/, 'binary[1]'],
  // 'char byte[2..255]/, 'binary[*]'],
  // 'char[0..1]/, 'nchar[1]'],
  // 'char[2..255]/, 'nchar[*]'],
   [/character/, 'nchar[1]'],
  // 'character varying[0..1]/, 'nvarchar[1]'],
  // 'character varying[2..255]/, 'nvarchar'],
  // 'character[0..1]/, 'nchar[1]'],
  // 'character[2..255]/, 'nchar[*]'],
  [/date/, 'date'],
  [/datetime/, 'datetime2'], // datetime without fraction
  //[/datetime/, 'datetime2[0]'], // datetime without fraction
  [/dec/, 'decimal'],
  // 'dec[*..65]/, 'decimal[*][0]'],
  // 'dec[*..65][*..30]/, 'decimal[*][*]'],
  [/decimal/, 'decimal'],
  // 'decimal[*..65]/, 'decimal[*][0]'],
  // 'decimal[*..65][*..30]/, 'decimal[*][*]'],
  [/double/, 'float[53]'],
  [/double precision/, 'float[53]'],
  // 'double precision[*..255][*..30]/, 'numeric[*][*]'],
  // 'double[*..255][*..30]/, 'numeric[*][*]'],
  [/fixed/, 'numeric'],
  // 'fixed[*..65][*..30]/, 'numeric[*][*]'],
  [/float/, 'float[24]'],
  // 'float[*..255][*..30]/, 'numeric[*][*]'],
  // 'float[*..53]/, 'float[53]'],
  [/int(?:\(\d+\))?/, 'int'], // 'int[*..255]/, 'int'],
  [/integer(?:\(\d+\))?/, 'int'], // 'integer[*..255]/, 'int'],
  [/longblob/, 'varbinary(max)'],
  [/longtext/, 'nvarchar(max)'],
  [/mediumblob/, 'varbinary(max)'],
  [/mediumint(?:\(\d+\))?/, 'int'], //  [/mediumint[*..255]/, 'int'],
  [/mediumtext/, 'nvarchar(max)'],
  [/national\s+char/, 'nchar[1]'],
  // 'national char[0..1]/, 'nchar[1]'],
  // 'national char[2..255]/, 'nchar[*]'],
  // 'national character/, 'nchar[1]'],
  // 'national character varying/, 'nvarchar[1]'],
  // 'national character varying[0..1]/, 'nvarchar[1]'],
  // 'national character varying[2..4000]/, 'nvarchar[*]'],
  // 'national character varying[4001..*]/, 'nvarchar(max)'],
  // 'national character[0..1]/, 'nchar[1]'],
  // 'national character[2..255]/, 'nchar[*]'],
  // 'national varchar/, 'nvarchar[1]'],
  // 'national varchar[0..1]/, 'nvarchar[1]'],
  // 'national varchar[2..4000]/, 'nvarchar[*]'],
  // 'national varchar[4001..*]/, 'nvarchar(max)'],
  [/nchar/, 'nchar[1]'],
  // 'nchar varchar/, 'nvarchar[1]'],
  // 'nchar varchar[0..1]/, 'nvarchar[1]'],
  // 'nchar varchar[2..4000]/, 'nvarchar[*]'],
  // 'nchar varchar[4001..*]/, 'nvarchar(max)'],
  // 'nchar[0..1]/, 'nchar[1]'],
  // 'nchar[2..255]/, 'nchar[*]'],
//  [/numeric/, 'numeric'],
  // 'numeric[*..65]/, 'numeric[*][0]'],
  // 'numeric[*..65][*..30]/, 'numeric[*][*]'],
   [/nvarchar(?:\(\[0-1]\))?/, 'nvarchar[1]'], // 'nvarchar/, 'nvarchar[1]'],  [/nvarchar[0..1]/, 'nvarchar[1]'],
  // 'nvarchar[2..4000]/, 'nvarchar[*]'],
  // 'nvarchar[4001..*]/, 'nvarchar(max)'],
  [/real/, 'float[53]'],
  // 'real[*..255][*..30]/, 'numeric[*][*]'],
  [/serial/, 'bigint'],
  [/smallint(?:\(\d+\))?/, 'smallint'], // 'smallint[*..255]/, 'smallint'],
  [/text/, 'nvarchar(max)'],
  // 'text[0..1]/, 'nvarchar[1]'],
  // 'text[2..4000]/, 'nvarchar[*]'],
  // 'text[4001..*]/, 'nvarchar(max)'],
  [/time/, 'time'],
  [/timestamp/, 'datetime'],
  [/tinyblob/, 'varbinary[255]'],
  [/tinyint/, 'smallint'], //'tinyint[*..255]/, 'smallint'],

  [/tinytext/, 'nvarchar[255]'],
  [/unsigned\s+bigint(?:\(\d+\))?/, 'bigint'],
  [/unsigned\s+dec/, 'decimal'],
  // 'unsigned dec[*..65]/, 'decimal[*][0]'],
  // 'unsigned dec[*..65][*..30]/, 'decimal[*][*]'],
  [/unsigned\s+decimal/, 'decimal'],
  // 'unsigned decimal[*..65]/, 'decimal[*][0]'],
  // 'unsigned decimal[*..65][*..30]/, 'decimal[*][*]'],
  [/unsigned\s+double/, 'float[53]'],
  [/unsigned\s+double\s+precision/, 'float[53]'],
  // 'unsigned double precision[*..255][*..30]/, 'numeric[*][*]'],
  // 'unsigned double[*..255][*..30]/, 'numeric[*][*]'],
  [/unsigned\s+fixed/, 'numeric'],
  // 'unsigned fixed[*..65][*..30]/, 'numeric[*][*]'],
  [/unsigned\s+float/, 'float[24]'],
  // 'unsigned float[*..255][*..30]/, 'numeric[*][*]'],
  // 'unsigned float[*..53]/, 'float[53]'],
  [/unsigned\s+int(?:\(\d+\))?/, 'bigint'],//  [/unsigned int[*..255]/, 'bigint'],
  [/unsigned\s+integer(?:\(\d+\))?/, 'bigint'], //'unsigned integer[*..255]/, 'bigint'],
  [/unsigned\s+mediumint(?:\(\d+\))?/, 'int'], //  [/unsigned mediumint[*..255]/, 'int'],
  [/unsigned\s+numeric/, 'numeric'],
  // 'unsigned numeric[*..65]/, 'numeric[*][0]'],
  // 'unsigned numeric[*..65][*..30]/, 'numeric[*][*]'],
  [/unsigned\s+real/, 'float[53]'],
  // 'unsigned real[*..255[[*..30]/, 'numeric[*][*]'],
  [/unsigned\s+smallint(?:\(\d+\))?/, 'int'], // 'unsigned smallint[*..255]/, 'int'],
  [/unsigned\s+tinyint/, 'tinyint'],
  // 'unsigned tinyint[*..255]/, 'tinyint'],
  // 'varbinary[0..1]/, 'varbinary[1]'],
  // 'varbinary[2..8000]/, 'varbinary[*]'],
  // 'varbinary[8001..*]/, 'varbinary(max)'],
  //[/varchar(?:\([0-1]\))/, 'nvarchar[1]'], // 'varchar[0..1]/, 'nvarchar[1]'],
  // 'varchar[2..4000]/, 'nvarchar[*]'],
  // 'varchar[4001..*]/, 'nvarchar(max)'],
  //[/varchar(\(\d+\))?/, 'nvarchar$1'],
  [/year(?:\(\d+\))?/, 'smallint'], //  [/year[2..2]': 'smallint'],  [/year[4..4]': 'smallint'],
]


const mapping = [
  {from: /CREATE\sTABLE((?:.+?\.)*([^\)]+?)\([^;]+)PRIMARY\sKEY\s(\([^\)]+\))/gm, to: 'CREATE TABLE $1CONSTRAINT PK_$2 PRIMARY KEY $3'}, // MYSQL TO SQLSERVER PK CONSTRAINT
  {from : /\`/gm,                                     to: ''},              // REMOVE ``
  {from : /_id\b/gim,                                 to: '_Id'},           // FIX ID CASE
  {from: /\bCOMMENT\W+.+?;/gim,                       to: '' },              // FIXME  REMOVE MYSQL COMMENT
  {from : /\n?ENGINE\s*?\=\s*?InnoDB/gim,             to: ''}, 	            // REMOVE MYSQL ENGINE
  {from : /\bIF\W+NOT\W+EXISTS\b/gm,                  to: ''},		          // REMOVE "IF NOT EXISTS"
  {from : /\bIF\W+EXISTS\b/gm,                        to: ''},			        // REMOVE "IF EXISTS"
  {from : /\bNOT\W+NULL\W+AUTO_INCREMENT\b/gm,        to: 'IDENTITY NOT NULL'},	// AUTO_INCREMENT STATEMENT -> IDENTITY STATEMENT1
  {from : /_?Id\sPRIMARY\sKEY\s\(\b/gim,              to: ' PRIMARY KEY ('},// FIXME REMOVE _Id FROM PK NAME
  {from : /\bfk_(\w)/gim,                             to: 'FK_$1'},
  {from : /\bfk_(\w+?_)+idx\b/gim,                    to: 'IX_$1'},		      // INDEX TO "IN_"
  {from : /\b(\w+)_UNIQUE\b/gim,                      to: 'UX_$1'}, 		    // UNIQUE INDEX TO "UN_"
  {from : /(.)_+?\s/gm, to: '$1 '},                                         // REMOVE TRAILING UNDERLINES
  {from : /DROP\W+SCHEMA([^;]+?);/gm,                   to: 'DROP SCHEMA $1;'},   // DROP SCHEMA
  {from : /CREATE\W+SCHEMA\s(.+?)\W+DEFAULT\W+CHARACTER.+?;/gm, to: 'CREATE SCHEMA $1;'}, // CREATE SCHEMA CLEAN
  {from : /^SET\s.+?;\r?\n?/gm,                       to: ''},              // REMOVE MYSQL "SET" STATEMENTS
  {from: /\b(FK.+?)1\b/gm,                            to: '$1' }            // REMOVE FK SUFFIX "1", keeping 2, 3, ...
]

const BLOCK_SEPARATOR = '\n' + '-'.repeat(15) +'\n'
const TYPE_REPLACEMENT_MARK = '§';

function convert(data) {

  // REPLACEMENT BY MAPPING
  mapping.forEach(item => data = data.replace(item.from, item.to));

  // PREPARE DATA SOURCES
  const appliedTypeRegexps = []

  const types = []

  const typeConversionDictionary = {};
  TYPE_CONVERSION_REFERENCE.forEach( reference => {
    types.push(reference[0].source)
    typeConversionDictionary[reference[0].source] = reference[1];
  })

   // MARK TYPES TO AVOID OVERLAPPING TYPE REPLACEMENT
  const marker = new RegExp('\\b(' + types.join('|') + ')\\b', 'gim');

  appliedTypeRegexps.push('MARKER REGEX>' + marker.source + ' '+ marker.flags, '\n')
  data = data.replace(marker, TYPE_REPLACEMENT_MARK + '$1' + TYPE_REPLACEMENT_MARK)

  // TYPE REPLACEMENT
  for (let replacementPattern in typeConversionDictionary) {

    const typeRegex = new RegExp(TYPE_REPLACEMENT_MARK + replacementPattern + TYPE_REPLACEMENT_MARK  , 'gim');
    appliedTypeRegexps.push('TYPE REGEX> ' + typeRegex.source  + ' '+ typeRegex.flags)
    data = data.replace(typeRegex, TYPE_REPLACEMENT_MARK + typeConversionDictionary[replacementPattern] + TYPE_REPLACEMENT_MARK)
  }

  console.log(appliedTypeRegexps.join('\n'));

  // CLEAN TYPE MARKERS
  data = data.replace(new RegExp(TYPE_REPLACEMENT_MARK, 'gim'), '')

  return data;
}
