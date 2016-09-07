const changeCase = require('change-case')

module.exports =

class MultiCase {

  constructor(string) {
    this.string = string
  }

  clone() { return new MultiCase(this.string) }

  set string(value) { this._string = String(value) }
  get string() { return this._string }

  toString() { return this._string }
  valueOf() { return this._string }

  get paramCase() { return changeCase.paramCase(this.string) }

  get pascalCase() { return changeCase.pascalCase(this.string) }

  get lowerCase() { return changeCase.lowerCase(this.string) }

  get upperCase() { return changeCase.upperCase(this.string) }

  get headerCase() { return changeCase.headerCase(this.string) }

  get pathCase() { return changeCase.pathCase(this.string) }

  get sentenceCase() { return changeCase.sentenceCase(this.string) }

  get snakeCase() { return changeCase.snakeCase(this.string) }

  get camelCase() { return changeCase.camelCase(this.string) }

  get dotCase() { return changeCase.dotCase(this.string) }

  get constantCase() { return changeCase.constantCase(this.string) }

  get namespaceLowerCase() { return this.dotCase }

  get namespacePascalCase() {
    return this.snakeCase.split('_').map(piece => new MultiCase(piece).pascalCase).join('.')
  }
}
