const CYRILLIC_LETTERS = 'абвгдежзиклмнопрстуфхцчшщюяіїєґ';

function randomCyrillicWord(length: number): string {
  let word = '';
  for (let i = 0; i < length; i++) {
    word += CYRILLIC_LETTERS[Math.floor(Math.random() * CYRILLIC_LETTERS.length)];
  }
  return word.charAt(0).toUpperCase() + word.slice(1);
}

function randomDigits(length: number): string {
  let digits = '';
  for (let i = 0; i < length; i++) {
    digits += Math.floor(Math.random() * 10);
  }
  return digits;
}

// Реальні коди українських мобільних операторів — сайт валідує номер
// саме за цим списком ("Вказуйте лише номери мобільних операторів України").
const MOBILE_OPERATOR_CODES = [
  '50', '63', '66', '67', '68', '73', '77', '91', '92', '93', '94', '95', '96', '97', '98', '99',
];

function randomOperatorCode(): string {
  return MOBILE_OPERATOR_CODES[Math.floor(Math.random() * MOBILE_OPERATOR_CODES.length)];
}

export interface RandomContactDetails {
  lastName: string;
  firstName: string;
  patronymic: string;
  // 9 цифр без ведучого "0" — маска "+38 (0__) ___-__-__" сама підставляє
  // фіксований "0", вводити його не потрібно (див. CheckoutPage.fillContactDetails).
  phone: string;
  email: string;
}

export function generateRandomContactDetails(): RandomContactDetails {
  return {
    lastName: randomCyrillicWord(8),
    firstName: randomCyrillicWord(6),
    patronymic: randomCyrillicWord(9),
    phone: randomOperatorCode() + randomDigits(7),
    email: `qa.test.${randomDigits(8)}@example.com`,
  };
}
