import * as assert from 'assert';
import {describe, it} from 'mocha';
import {Parser} from '../../src/parser';
import {RuleParser} from '../../src/ruleparser';

describe('ParserFullDocument', () => {
    it('parse simple string', async () => {
        const ruleDoc = `select = "SELECT";`;
        const rules = new RuleParser().Parse(ruleDoc);
        const doc = `SELECT`;
        const result = new Parser(rules).ParseFullDocument(doc);
        assert.strictEqual(result.text, 'SELECT');
        assert.strictEqual(result.rule, 'select');
    });

    it('parse simple reference', async () => {
        const ruleDoc = `item1 = item2;item2 = item3; item3 = "SELECT";`;
        const rules = new RuleParser().Parse(ruleDoc);
        const doc = `SELECT`;
        const result = new Parser(rules).ParseFullDocument(doc);
        assert.strictEqual(result.text, 'SELECT');
        assert.strictEqual(result.rule, 'item1');
        assert.strictEqual(result.children.length, 1);
        assert.strictEqual(result.children[0].rule, 'item2');
        assert.strictEqual(result.children[0].children.length, 1);
        assert.strictEqual(result.children[0].children[0].rule, 'item3');
    });

    it('parse group reference', async () => {
        const ruleDoc = `item1 = item2 item3; item2 = "SELECT"; item3 = "*";`;
        const rules = new RuleParser().Parse(ruleDoc);
        const doc = `SELECT*`;
        const result = new Parser(rules).ParseFullDocument(doc);
        assert.strictEqual(result.text, 'SELECT*');
        assert.strictEqual(result.rule, 'item1');
        assert.strictEqual(result.children.length, 2);
        assert.strictEqual(result.children[0].rule, 'item2');
        assert.strictEqual(result.children[0].text, 'SELECT');
        assert.strictEqual(result.children[1].rule, 'item3');
        assert.strictEqual(result.children[1].text, '*');
    });

    it('parse alternation node', async () => {
        const ruleDoc = `item1 = item2 | item3; item2 = "SELECT"; item3 = "INSERT";`;
        const rules = new RuleParser().Parse(ruleDoc);
        const doc1 = `SELECT`;
        const result1 = new Parser(rules).ParseFullDocument(doc1);
        assert.strictEqual(result1.text, 'SELECT');
        assert.strictEqual(result1.rule, 'item1');
        assert.strictEqual(result1.children.length, 1);
        assert.strictEqual(result1.children[0].rule, 'item2');
        assert.strictEqual(result1.children[0].text, 'SELECT');

        const doc2 = `INSERT`;
        const result2 = new Parser(rules).ParseFullDocument(doc2);
        assert.strictEqual(result2.text, 'INSERT');
        assert.strictEqual(result2.rule, 'item1');
        assert.strictEqual(result2.children.length, 1);
        assert.strictEqual(result2.children[0].rule, 'item3');
        assert.strictEqual(result2.children[0].text, 'INSERT');
    });

    it('parse option node', async () => {
        const ruleDoc = `item1 = [ item2 ] item3; item2 = "AS"; item3 = "TEXT";`;
        const rules = new RuleParser().Parse(ruleDoc);
        const doc1 = `ASTEXT`;
        const result1 = new Parser(rules).ParseFullDocument(doc1);
        assert.strictEqual(result1.text, 'ASTEXT');
        assert.strictEqual(result1.rule, 'item1');
        assert.strictEqual(result1.children.length, 2);
        assert.strictEqual(result1.children[0].rule, 'item2');
        assert.strictEqual(result1.children[0].text, 'AS');
        assert.strictEqual(result1.children[1].rule, 'item3');
        assert.strictEqual(result1.children[1].text, 'TEXT');

        const doc2 = `TEXT`;
        const result2 = new Parser(rules).ParseFullDocument(doc2);
        assert.strictEqual(result2.text, 'TEXT');
        assert.strictEqual(result2.rule, 'item1');
        assert.strictEqual(result2.children.length, 1);
        assert.strictEqual(result2.children[0].rule, 'item3');
        assert.strictEqual(result2.children[0].text, 'TEXT');
    });

    it('parse repeat node', async () => {
        const ruleDoc = `p = { a | b } c ; a = "a"; b = "b"; c = "c"; `;
        const rules = new RuleParser().Parse(ruleDoc);
        const parser = new Parser(rules);
        const result1 = parser.ParseFullDocument(`aaac`);
        assert.strictEqual(result1.text, 'aaac');
        assert.strictEqual(result1.rule, 'p');
        assert.strictEqual(result1.children.length, 4);

        const result2 = parser.ParseFullDocument(`bbbc`);
        assert.strictEqual(result2.text, 'bbbc');
        assert.strictEqual(result2.rule, 'p');
        assert.strictEqual(result2.children.length, 4);

        const result3 = parser.ParseFullDocument(`bc`);
        assert.strictEqual(result3.text, 'bc');
        assert.strictEqual(result3.rule, 'p');
        assert.strictEqual(result3.children.length, 2);

        try {
            parser.ParseFullDocument(`c`);
            assert.fail();
        } catch (e) {
            // ok
        }
    });

    it('parse regex node', async () => {
        const ruleDoc = `item1 = item2 | item3 ; item2 = /\\d+/; item3 = /\\w+/;`;
        const rules = new RuleParser().Parse(ruleDoc);
        const parser = new Parser(rules);
        const result1 = parser.ParseFullDocument(`12345`);
        assert.strictEqual(result1.text, '12345');
        assert.strictEqual(result1.rule, 'item1');
        assert.strictEqual(result1.children.length, 1);
        assert.strictEqual(result1.children[0].text, '12345');
        const result2 = parser.ParseFullDocument(`abcde`);
        assert.strictEqual(result2.children.length, 1);
        assert.strictEqual(result2.children[0].text, 'abcde');
    });
});
