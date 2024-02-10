import { evaluateArithmeticExpression } from "../../../src/scripts/tools/calculator";

describe('evaluateArithmeticExpression', () => {
  test('should evaluate simple arithmetic expression correctly', () => {
    const expression = ["1", "+", "5", "*", "8"];
    expect(evaluateArithmeticExpression(expression)).toBe(41);
  });

  test('should handle parentheses correctly', () => {
    const expression = ["(", "1", "+", "5", ")", "*", "8"];
    expect(evaluateArithmeticExpression(expression)).toBe(48);
  });

  // Add more test cases as needed...
});
