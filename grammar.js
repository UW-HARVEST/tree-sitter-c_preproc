/**
 * @file C preprocessor grammar for tree-sitter
 * @author Haoran Peng <hrpeng@cs.washington.edu>
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const PREC = {
  COMMA: -3,
  CONDITIONAL: -1,
  LOGICAL_OR: 1,
  LOGICAL_AND: 2,
  INCLUSIVE_OR: 3,
  EXCLUSIVE_OR: 4,
  BITWISE_AND: 5,
  EQUAL: 6,
  RELATIONAL: 7,
  SHIFT: 9,
  ADD: 10,
  MULTIPLY: 11,
  UNARY: 14,
  CALL: 15,
};

module.exports = grammar({
  name: 'c_preproc',

  extras: $ => [
    /\s|\\\r?\n/,
    $.comment,
  ],

  word: $ => $.identifier,

  rules: {
    translation_unit: $ => repeat($._block_item),

    _block_item: $ => choice(
      $.preproc_if,
      $.preproc_ifdef,
      $.preproc_ifndef,
      $.preproc_include,
      $.preproc_include_next,
      $.preproc_def,
      $.preproc_function_def,
      $.preproc_undef,
      $.preproc_error,
      $.preproc_line,
      $.preproc_eval,
      $.preproc_call,
      $.c_tokens,
    ),

    block_items: $ => repeat1($._block_item),

    // Preprocesser

    preproc_include: $ => seq(
      preprocessor('include'),
      field('path', choice(
        $.string_literal,
        $.system_lib_string,
        $.identifier,
        alias($.preproc_call_expression, $.call_expression),
      )),
      token(/\r?\n/),
    ),

    preproc_include_next: $ => seq(
      preprocessor('include_next'),
      field('path', choice(
        $.string_literal,
        $.system_lib_string,
        $.identifier,
        alias($.preproc_call_expression, $.call_expression),
      )),
      token(/\r?\n/),
    ),

    preproc_def: $ => seq(
      preprocessor('define'),
      field('name', $.identifier),
      field('value', optional($.preproc_tokens)),
      token(/\r?\n/),
    ),

    preproc_function_def: $ => seq(
      preprocessor('define'),
      field('name', $.identifier),
      field('parameters', $.preproc_params),
      token.immediate(/[ \t]*/),
      field('value', optional($.preproc_tokens)),
      token.immediate(/\r?\n/),
    ),

    preproc_undef: $ => seq(
      preprocessor('undef'),
      field('name', $.identifier),
      token(/\r?\n/),
    ),

    preproc_error: $ => seq(
      preprocessor('error'),
      optional(field('message', $.preproc_arg)),
      token(/\r?\n/),
    ),

    variadic_parameter: _ => '...',

    preproc_params: $ => seq(
      token.immediate('('),
      commaSep(
        field(
          'parameter',
          choice($.identifier, $.variadic_parameter),
        )
      ),
      ')',
    ),

    preproc_line: $ => seq(
      choice(
        preprocessor('line'),
        alias(token(/#[ \t]*/), '#line'),
      ),
      field('line_number', $.number_literal),
      optional(field('filename', $.string_literal)),
      repeat($.number_literal),
      token(/\r?\n/),
    ),

    preproc_eval: $ => seq(
      preprocessor('eval'),
      field('expr', $._preproc_expression),
      token(/\r?\n/),
      preprocessor('endeval'),
    ),

    preproc_call: $ => seq(
      field('directive', $.preproc_directive),
      optional(token.immediate(/[ \t]*/)),
      field('argument', optional($.preproc_arg)),
      token(/\r?\n/),
    ),

    ...preprocIf('', $ => $.block_items),

    preproc_arg: _ => token(prec(-1, /\S([^/\n]|\/[^*]|\\\r?\n)*/)),
    preproc_directive: _ => /#[ \t]*[a-zA-Z]\w*/,

    _preproc_expression: $ => choice(
      $.identifier,
      alias($.preproc_call_expression, $.call_expression),
      $.number_literal,
      $.char_literal,
      $.preproc_defined,
      alias($.preproc_unary_expression, $.unary_expression),
      alias($.preproc_binary_expression, $.binary_expression),
      alias($.preproc_parenthesized_expression, $.parenthesized_expression),
      alias($.preproc_conditional_expression, $.conditional_expression),
    ),

    preproc_tokens: $ => $._preproc_tokens,

    _preproc_tokens: $ => prec.left(field('token',
      repeat1(
        $._preproc_token,
    ),
  )),

    _preproc_token: $ => choice(
      $.identifier,
      $.number_literal,
      $.char_literal,
      $.preproc_defined_literal,
      choice('!', '~', '-', '+'), // unary operators
      choice('(', ')', '{', '}', '[', ']'), // parentheses
      // preprocessor binary operators that are not also unary operators
      choice('*', '/', '%', '||', '&&', '|', '^', '&', '==', '!=', '>', '>=', '<=', '<', '<<', '>>', ','),
      choice('?', ':'),
      $.string_literal,
      $.system_lib_string,
      choice('##', '#'),
      choice('=', '*=', '/=', '%=', '+=', '-=', '<<=', '>>=', '&=', '^=', '|='), // other C operators
      choice(';', '...', '.', '->', '::', '[[', ']]'), // other C operators
    ),

    c_tokens: $ => prec.right(field('token',
      repeat1(
        $._c_token,
      ),
    )),

    _c_token: $ => choice(
      $._preproc_token,
      $.comment,
      choice(
        'auto', 'break', 'case', 'char', 'const',
        'continue', 'default', 'do', 'double', 'else',
        'enum', 'extern', 'float', 'for', 'if',
        'int', 'long', 'register', 'return', 'short',
        'signed', 'sizeof', 'static', 'struct', 'switch',
        'typedef', 'union', 'unsigned', 'void', 'goto',
        'volatile', 'while',
      )
    ),

    preproc_parenthesized_expression: $ => seq(
      '(',
      field('expr', $._preproc_expression),
      ')',
    ),

    preproc_defined: $ => choice(
      prec(PREC.CALL, seq('defined', '(', field('name', $.identifier), ')')),
      seq('defined', field('name', $.identifier)),
    ),

    preproc_defined_literal: $ => 'defined',

    preproc_unary_expression: $ => prec.left(PREC.UNARY, seq(
      field('operator', choice('!', '~', '-', '+')),
      field('argument', $._preproc_expression),
    )),

    preproc_call_expression: $ => prec(PREC.CALL, seq(
      field('function', $.identifier),
      field('arguments', alias($.preproc_argument_list, $.argument_list)),
    )),

    preproc_argument_list: $ => prec(PREC.CALL, seq(
      '(',
      commaSep(
        field(
          'argument',
          $._preproc_expression,
        ),
      ),
      ')',
    )),

    preproc_binary_expression: $ => {
      const table = [
        ['+', PREC.ADD],
        ['-', PREC.ADD],
        ['*', PREC.MULTIPLY],
        ['/', PREC.MULTIPLY],
        ['%', PREC.MULTIPLY],
        ['||', PREC.LOGICAL_OR],
        ['&&', PREC.LOGICAL_AND],
        ['|', PREC.INCLUSIVE_OR],
        ['^', PREC.EXCLUSIVE_OR],
        ['&', PREC.BITWISE_AND],
        ['==', PREC.EQUAL],
        ['!=', PREC.EQUAL],
        ['>', PREC.RELATIONAL],
        ['>=', PREC.RELATIONAL],
        ['<=', PREC.RELATIONAL],
        ['<', PREC.RELATIONAL],
        ['<<', PREC.SHIFT],
        ['>>', PREC.SHIFT],
        [',', PREC.COMMA],
      ];

      return choice(...table.map(([operator, precedence]) => {
        return prec.left(precedence, seq(
          field('left', $._preproc_expression),
          // @ts-ignore
          field('operator', operator),
          field('right', $._preproc_expression),
        ));
      }));
    },

    preproc_conditional_expression: $ => prec.right(PREC.CONDITIONAL, seq(
      field('condition', $._preproc_expression),
      '?',
      optional(field('consequence', $._preproc_expression)),
      ':',
      field('alternative', $._preproc_expression),
    )),

    number_literal: _ => {
      const separator = '\'';
      const hex = /[0-9a-fA-F]/;
      const decimal = /[0-9]/;
      const hexDigits = seq(repeat1(hex), repeat(seq(separator, repeat1(hex))));
      const decimalDigits = seq(repeat1(decimal), repeat(seq(separator, repeat1(decimal))));
      return token(seq(
        optional(/[-\+]/),
        optional(choice(/0[xX]/, /0[bB]/)),
        choice(
          seq(
            choice(
              decimalDigits,
              seq(/0[bB]/, decimalDigits),
              seq(/0[xX]/, hexDigits),
            ),
            optional(seq('.', optional(hexDigits))),
          ),
          seq('.', decimalDigits),
        ),
        optional(seq(
          /[eEpP]/,
          optional(seq(
            optional(/[-\+]/),
            hexDigits,
          )),
        )),
        /[uUlLwWfFbBdD]*/,
      ));
    },

    char_literal: $ => seq(
      choice('L\'', 'u\'', 'U\'', 'u8\'', '\''),
      repeat1(choice(
        $.escape_sequence,
        alias(token.immediate(/[^\n']/), $.character),
      )),
      '\'',
    ),

    string_literal: $ => seq(
      choice('L"', 'u"', 'U"', 'u8"', '"'),
      repeat(choice(
        alias(token.immediate(prec(1, /[^\\"\n]+/)), $.string_content),
        $.escape_sequence,
      )),
      '"',
    ),

    escape_sequence: _ => token(prec(1, seq(
      '\\',
      choice(
        /[^xuU]/,
        /\d{2,3}/,
        /x[0-9a-fA-F]{1,4}/,
        /u[0-9a-fA-F]{4}/,
        /U[0-9a-fA-F]{8}/,
      ),
    ))),

    system_lib_string: _ => token(seq(
      '<',
      repeat(choice(/[^>\n]/, '\\>')),
      '>',
    )),

    identifier: _ =>
      /(\p{XID_Start}|\$|_|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})(\p{XID_Continue}|\$|\\u[0-9A-Fa-f]{4}|\\U[0-9A-Fa-f]{8})*/,

    // http://stackoverflow.com/questions/13014947/regex-to-match-a-c-style-multiline-comment/36328890#36328890
    comment: _ => token(choice(
      seq('//', /(\\+(.|\r?\n)|[^\\\n])*/),
      seq(
        '/*',
        /[^*]*\*+([^/*][^*]*\*+)*/,
        '/',
      ),
    )),
  },
});

/**
 *
 * @param {string} suffix
 *
 * @param {RuleBuilder<string>} content
 *
 * @param {number} precedence
 *
 * @returns {RuleBuilders<string, string>}
 */
function preprocIf(suffix, content, precedence = 0) {
  /**
   *
   * @param {GrammarSymbols<string>} $
   *
   * @returns {ChoiceRule}
   */
  function alternativeBlock($) {
    return choice(
      suffix ? alias($['preproc_else' + suffix], $.preproc_else) : $.preproc_else,
      suffix ? alias($['preproc_elif' + suffix], $.preproc_elif) : $.preproc_elif,
      suffix ? alias($['preproc_elifdef' + suffix], $.preproc_elifdef) : $.preproc_elifdef,
      suffix ? alias($['preproc_elifndef' + suffix], $.preproc_elifndef) : $.preproc_elifndef,
    );
  }

  return {
    ['preproc_if' + suffix]: $ => prec.left(precedence, seq(
      preprocessor('if'),
      field('condition', $.preproc_tokens),
      '\n',
      optional(field('body', content($))),
      choice(
        field('alternative', alternativeBlock($)),
        preprocessor('endif'),
      ),
    )),

    ['preproc_ifdef' + suffix]: $ => prec(precedence, seq(
      preprocessor('ifdef'),
      field('name', $.identifier),
      optional(field('body', content($))),
      choice(
        field('alternative', alternativeBlock($)),
        preprocessor('endif'),
      ),
    )),

    ['preproc_ifndef' + suffix]: $ => prec(precedence, seq(
      preprocessor('ifndef'),
      field('name', $.identifier),
      optional(field('body', content($))),
      choice(
        field('alternative', alternativeBlock($)),
        preprocessor('endif'),
      ),
    )),

    ['preproc_else' + suffix]: $ => prec(precedence, seq(
      preprocessor('else'),
      optional(field('body', content($))),
      preprocessor('endif'),
    )),

    ['preproc_elif' + suffix]: $ => prec(precedence, seq(
      preprocessor('elif'),
      field('condition', $.preproc_tokens),
      '\n',
      optional(field('body', content($))),
      choice(
        field('alternative', alternativeBlock($)),
        preprocessor('endif'),
      ),
    )),

    ['preproc_elifdef' + suffix]: $ => prec(precedence, seq(
      preprocessor('elifdef'),
      field('name', $.identifier),
      optional(field('body', content($))),
      choice(
        field('alternative', alternativeBlock($)),
        preprocessor('endif'),
      ),
    )),

    ['preproc_elifndef' + suffix]: $ => prec(precedence, seq(
      preprocessor('elifndef'),
      field('name', $.identifier),
      optional(field('body', content($))),
      choice(
        field('alternative', alternativeBlock($)),
        preprocessor('endif'),
      ),
    )),
  };
}

/**
 * Creates a preprocessor regex rule
 *
 * @param {RegExp | Rule | string} command
 *
 * @returns {AliasRule}
 */
function preprocessor(command) {
  return alias(new RegExp('#[ \t]*' + command), '#' + command);
}

/**
 * Creates a rule to optionally match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @returns {ChoiceRule}
 */
function commaSep(rule) {
  return optional(commaSep1(rule));
}

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 *
 * @returns {SeqRule}
 */
function commaSep1(rule) {
  return seq(rule, repeat(seq(',', rule)));
}

module.exports.PREC = PREC;
module.exports.preprocIf = preprocIf;
module.exports.preprocessor = preprocessor;
module.exports.commaSep = commaSep;
module.exports.commaSep1 = commaSep1;
