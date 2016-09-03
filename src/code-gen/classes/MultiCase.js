const changeCase = require('change-case')

module.exports =

class MultiCase {
  constructor(word) {
    this.word = word
  }

  clone() { return new MultiCase(this.word) }

  set word(value) { this._word = String(value) }
  get word() { return this._word }

  toString() { return this._word }
  valueOf() { return this._word }

  get paramCase() { return changeCase.paramCase(this.word) }

  get pascalCase() { return changeCase.pascalCase(this.word) }

  get lowerCase() { return changeCase.lowerCase(this.word) }

  get upperCase() { return changeCase.upperCase(this.word) }

  get headerCase() { return changeCase.headerCase(this.word) }

  get pathCase() { return changeCase.pathCase(this.word) }

  get sentenceCase() { return changeCase.sentenceCase(this.word) }

  get snakeCase() { return changeCase.snakeCase(this.word) }

  get camelCase() { return changeCase.camelCase(this.word) }

  get dotCase() { return changeCase.dotCase(this.word) }

  get constantCase() { return changeCase.constantCase(this.word) }

  get namespaceLowerCase() { return this.dotCase }

  get namespacePascalCase() {
    let result = ''
    this.dotCase.split('.').forEach(part=> {
      result += (result ? '.' : '') + new MultiCase(part).pascalCase
    })
    return result
  }
}
