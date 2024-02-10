import { evaluateExpression } from "../../../src/scripts/tools/calculator";

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
