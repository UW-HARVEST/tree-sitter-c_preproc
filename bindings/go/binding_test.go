package tree_sitter_c_preproc_test

import (
	"testing"

	tree_sitter "github.com/tree-sitter/go-tree-sitter"
	tree_sitter_c_preproc "github.com/tree-sitter/tree-sitter-c_preproc/bindings/go"
)

func TestCanLoadGrammar(t *testing.T) {
	language := tree_sitter.NewLanguage(tree_sitter_c_preproc.Language())
	if language == nil {
		t.Errorf("Error loading C Preprocessor grammar")
	}
}
