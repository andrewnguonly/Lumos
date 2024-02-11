import { Calculator } from "../../src/tools/calculator";

describe("Calculator", () => {
  let calculator: Calculator;

  beforeEach(() => {
    calculator = new Calculator();
  });

  describe("extractArithmeticTokens", () => {
    test("should handle addition operator", () => {
      const input = "25+1?";
      const expectedOutput = ["25", "+", "1"];
      expect(calculator._extractTokens(input)).toEqual(expectedOutput);
    });

    test("should handle subtraction operator", () => {
      const input = "25-1?";
      const expectedOutput = ["25", "+", "-1"];
      expect(calculator._extractTokens(input)).toEqual(expectedOutput);
    });

    test("should handle multiplication operator", () => {
      const input = "25*1?";
      const expectedOutput = ["25", "*", "1"];
      expect(calculator._extractTokens(input)).toEqual(expectedOutput);
    });

    test("should handle division operator", () => {
      const input = "25/1?";
      const expectedOutput = ["25", "/", "1"];
      expect(calculator._extractTokens(input)).toEqual(expectedOutput);
    });

    test("should handle exponent operator", () => {
      const input = "25^1?";
      const expectedOutput = ["25", "^", "1"];
      expect(calculator._extractTokens(input)).toEqual(expectedOutput);
    });

    test("should handle decimal numbers", () => {
      const input = "25.222+1.0092?";
      const expectedOutput = ["25.222", "+", "1.0092"];
      expect(calculator._extractTokens(input)).toEqual(expectedOutput);
    });

    test("should handle negative numbers", () => {
      const input = "-25 * -2?";
      const expectedOutput = ["-25", "*", "-2"];
      expect(calculator._extractTokens(input)).toEqual(expectedOutput);
    });

    test("should handle negative decimal numbers", () => {
      const input = "-25 * -2.88?";
      const expectedOutput = ["-25", "*", "-2.88"];
      expect(calculator._extractTokens(input)).toEqual(expectedOutput);
    });

    test("should handle parentheses", () => {
      const input = "(5+5)*0.8?";
      const expectedOutput = ["(", "5", "+", "5", ")", "*", "0.8"];
      expect(calculator._extractTokens(input)).toEqual(expectedOutput);
    });

    test("should handle nested parentheses", () => {
      const input = "(5+(2^3))*0.8?";
      const expectedOutput = ["(", "5", "+", "(", "2", "^", "3", ")",  ")", "*", "0.8"];
      expect(calculator._extractTokens(input)).toEqual(expectedOutput);
    });

    test("should handle 3+ operands and operators", () => {
      const input = "2.5 + 3.7 / 0.5 - 20 + 55 ^ 4 =";
      const expectedOutput = ["2.5", "+", "3.7", "/", "0.5", "-", "20", "+", "55", "^", "4"];
      expect(calculator._extractTokens(input)).toEqual(expectedOutput);
    });

    test("should handle double minus", () => {
      const input = "2.5 - -3.7";
      const expectedOutput = ["2.5", "-", "-3.7"];
      expect(calculator._extractTokens(input)).toEqual(expectedOutput);
    });
  });

  describe("evaluateExpression", () => {
    test("should evaluate addition expression", () => {
      const expression = ["1", "+", "5"];
      expect(calculator._evaluateExpression(expression)).toBe(6);
    });

    test("should evaluate subtraction expression", () => {
      const expression = ["1", "-", "5"];
      expect(calculator._evaluateExpression(expression)).toBe(-4);
    });

    test("should evaluate multiplication expression", () => {
      const expression = ["1", "*", "5"];
      expect(calculator._evaluateExpression(expression)).toBe(5);
    });

    test("should evaluate division expression", () => {
      const expression = ["5", "/", "5"];
      expect(calculator._evaluateExpression(expression)).toBe(1);
    });

    test("should evaluate exponent expression", () => {
      const expression = ["5", "^", "5"];
      expect(calculator._evaluateExpression(expression)).toBe(3125);
    });

    test("should evaluate negative numbers expression", () => {
      const expression = ["-5", "+", "-5"];
      expect(calculator._evaluateExpression(expression)).toBe(-10);
    });

    test("should evaluate decimal numbers expression", () => {
      const expression = ["-5.5", "+", "-5.6"];
      expect(calculator._evaluateExpression(expression)).toBe(-11.1);
    });

    test("should evaluate simple arithmetic expression", () => {
      const expression = ["1", "+", "5", "*", "8"];
      expect(calculator._evaluateExpression(expression)).toBe(41);
    });

    test("should evaluate complex arithmetic expression", () => {
      const expression = [
        "1",
        "+",
        "5",
        "*",
        "8",
        "+",
        "1",
        "-",
        "5",
        "*",
        "8",
      ];
      expect(calculator._evaluateExpression(expression)).toBe(2);
    });

    test("should handle parentheses expression", () => {
      const expression = ["(", "1", "+", "5", ")", "*", "8"];
      expect(calculator._evaluateExpression(expression)).toBe(48);
    });

    test("should handle nesteed parentheses expression", () => {
      const expression = ["(", "5", "+", "(", "2", "^", "3", ")",  ")", "*", "0.8"];
      expect(calculator._evaluateExpression(expression)).toBe(10.4);
    });
  });
});
