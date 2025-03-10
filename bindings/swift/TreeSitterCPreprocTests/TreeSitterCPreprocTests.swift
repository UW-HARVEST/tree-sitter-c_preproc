import XCTest
import SwiftTreeSitter
import TreeSitterCPreproc

final class TreeSitterCPreprocTests: XCTestCase {
    func testCanLoadGrammar() throws {
        let parser = Parser()
        let language = Language(language: tree_sitter_c_preproc())
        XCTAssertNoThrow(try parser.setLanguage(language),
                         "Error loading C Preprocessor grammar")
    }
}
