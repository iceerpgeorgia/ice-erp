// Test regex patterns against B5 with formula
const b5Empty = '<c r="B5" s="13"/>';
const b5WithFormula = '<c r="B5" s="15" t="str"><f>IFERROR(LEFT(...)</f></c>';
const b2Empty = '<c r="B2" s="13"/>';

const pattern1 = /(<c r="B5"[^>]*>.*?)<v>[^<]*<\/v>(.*?<\/c>)/s;
const pattern2 = /<c r="B5"([^>]*)\/>/s;

console.log('=== PATTERN TEST ===\n');

console.log('B5 empty cell:', b5Empty);
console.log('  Pattern1 (has <v>):', pattern1.test(b5Empty));
console.log('  Pattern2 (self-closing):', pattern2.test(b5Empty));

console.log('\nB5 with formula:', b5WithFormula);
console.log('  Pattern1 (has <v>):', pattern1.test(b5WithFormula));
console.log('  Pattern2 (self-closing):', pattern2.test(b5WithFormula));

console.log('\nB2 empty:', b2Empty);
console.log('  Pattern2 (self-closing):', pattern2.test(b2Empty));
