const fs = require('fs');
const content = fs.readFileSync('frontend/src/components/AppointmentsWithAttention.jsx', 'utf8');

function checkMismatched(str) {
  const stack = [];
  const map = { ')': '(', '}': '{', ']': '[' };
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(' || char === '{' || char === '[') {
      stack.push({ char, line: str.substring(0, i).split('\n').length });
    } else if (char === ')' || char === '}' || char === ']') {
      if (stack.length === 0) return `Extra ${char} at line ${str.substring(0, i).split('\n').length}`;
      const last = stack.pop();
      if (last.char !== map[char]) return `Mismatched ${char} at line ${str.substring(0, i).split('\n').length}, expected ${last.char} from line ${last.line}`;
    }
  }
  if (stack.length > 0) return `Unclosed ${stack[0].char} from line ${stack[0].line}`;
  return 'OK';
}

// console.log(checkMismatched(content));
