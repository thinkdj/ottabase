// @ts-nocheck - the official @editorjs tool packages ship without type declarations
/**
 * The official Editor.js tools, imported once and typed as block tool constructors, so no other
 * file imports an untyped package directly (the app's stricter type-check would reject it).
 */
import type { BlockToolConstructable, InlineToolConstructable } from '@editorjs/editorjs';
import CheckList from '@editorjs/checklist';
import Delimiter from '@editorjs/delimiter';
import Embed from '@editorjs/embed';
import Header from '@editorjs/header';
import InlineCode from '@editorjs/inline-code';
import LinkTool from '@editorjs/link';
import Marker from '@editorjs/marker';
import NestedList from '@editorjs/nested-list';
import Paragraph from '@editorjs/paragraph';
import Quote from '@editorjs/quote';
import Table from '@editorjs/table';
import Underline from '@editorjs/underline';
import Warning from '@editorjs/warning';

const block = (tool: unknown) => tool as BlockToolConstructable;
const inline = (tool: unknown) => tool as InlineToolConstructable;

export const officialBlockTools = {
    CheckList: block(CheckList),
    Delimiter: block(Delimiter),
    Embed: block(Embed),
    Header: block(Header),
    LinkTool: block(LinkTool),
    NestedList: block(NestedList),
    Paragraph: block(Paragraph),
    Quote: block(Quote),
    Table: block(Table),
    Warning: block(Warning),
};

export const officialInlineTools = {
    InlineCode: inline(InlineCode),
    Marker: inline(Marker),
    Underline: inline(Underline),
};
