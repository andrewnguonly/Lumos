import {
  evaluateExpression,
  extractTokens,
} from "../../../src/scripts/tools/calculator";

describe("extractArithmeticTokens", () => {
  test("should handle subtraction", () => {
    const input = "25-1?";
    const expectedOutput = ["25", "-", "1"];
    expect(extractTokens(input)).toEqual(expectedOutput);
  });

  test("should return the correct list of tokens", () => {
    const input = "What's (5+5)*0.8?";
    const expectedOutput = ["(", "5", "+", "5", ")", "*", "0.8"];
    expect(extractTokens(input)).toEqual(expectedOutput);
  });

  test("should handle negative numbers", () => {
    const input = "-10+(-2)*3";
    const expectedOutput = ["-10", "+", "(", "-2", ")", "*", "3"];
    expect(extractTokens(input)).toEqual(expectedOutput);
  });

  test("should handle decimal numbers", () => {
    const input = "2.5 + 3.7 / 0.5";
    const expectedOutput = ["2.5", "+", "3.7", "/", "0.5"];
    expect(extractTokens(input)).toEqual(expectedOutput);
  });

  test("should handle calculate: trigger", () => {
    const input = "calculate: 2.5 + 3.7 / 0.5 =";
    const expectedOutput = ["2.5", "+", "3.7", "/", "0.5"];
    expect(extractTokens(input)).toEqual(expectedOutput);
  });

  test("should handle double minus", () => {
    const input = "2.5 - -3.7";
    const expectedOutput = ["2.5", "-", "-3.7"];
    expect(extractTokens(input)).toEqual(expectedOutput);
  });
});

describe("evaluateExpression", () => {
  test("should evaluate addition expression correctly", () => {
    const expression = ["1", "+", "5"];
    expect(evaluateExpression(expression)).toBe(6);
  });

  test("should evaluate subtraction expression correctly", () => {
    const expression = ["1", "-", "5"];
    expect(evaluateExpression(expression)).toBe(-4);
  });

  test("should evaluate multiplication expression correctly", () => {
    const expression = ["1", "*", "5"];
    expect(evaluateExpression(expression)).toBe(5);
  });

  test("should evaluate division expression correctly", () => {
    const expression = ["5", "/", "5"];
    expect(evaluateExpression(expression)).toBe(1);
  });

  test("should evaluate exponent expression correctly", () => {
    const expression = ["5", "^", "5"];
    expect(evaluateExpression(expression)).toBe(3125);
  });

  test("should evaluate negative numbers correctly", () => {
    const expression = ["-5", "+", "-5"];
    expect(evaluateExpression(expression)).toBe(-10);
  });

  test("should evaluate decimal numbers correctly", () => {
    const expression = ["-5.5", "+", "-5.6"];
    expect(evaluateExpression(expression)).toBe(-11.1);
  });

  test("should evaluate simple arithmetic expression correctly", () => {
    const expression = ["1", "+", "5", "*", "8"];
    expect(evaluateExpression(expression)).toBe(41);
  });

  test("should evaluate complex arithmetic expression correctly", () => {
    const expression = ["1", "+", "5", "*", "8", "+", "1", "-", "5", "*", "8"];
    expect(evaluateExpression(expression)).toBe(2);
  });

  test("should handle parentheses correctly", () => {
    const expression = ["(", "1", "+", "5", ")", "*", "8"];
    expect(evaluateExpression(expression)).toBe(48);
  });
});
