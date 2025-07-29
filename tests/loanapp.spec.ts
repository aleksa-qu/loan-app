import { test, expect, Route } from '@playwright/test';
import loanPage from '../src/pages/LoanPage/LoanPage';
import FinalPage from '../src/pages/FinalPage/FinalPage';

const serviceURL = 'http://localhost:3000';

test('main flow', async ({ page }) => {
  await page.goto(serviceURL);
  await page.getByTestId('id-small-loan-calculator-field-apply').click();
  await page.getByTestId('login-popup-username-input').click();
  await page.getByTestId('login-popup-username-input').fill('usern');
  await page.getByTestId('login-popup-username-input').press('Tab');
  await page.getByTestId('login-popup-password-input').fill('pwd');
  await page.getByTestId('login-popup-continue-button').click();
  await page.getByTestId('final-page-continue-button').click();
  await page.getByTestId('final-page-success-ok-button').click();
});

test('redirect flow', async ({ page, request }) => {
  await page.goto(serviceURL);
  await page.getByTestId('id-image-element-button-image-1').click();
  await expect(
    page.getByTestId('id-small-loan-calculator-field-apply'),
  ).toBeInViewport();
  await page.getByTestId('id-image-element-button-image-2').click();
  await expect(
    page.getByTestId('id-small-loan-calculator-field-apply'),
  ).toBeInViewport();
});

test('error message case', async ({ page, request }) => {
  await page.route(
    '**/api/loan-calc?amount=*&period=*',
    async (route: Route) => {
      const request = route.request();
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 400,
        });
      } else {
        await route.continue();
      }
    },
  );

  await page.goto(serviceURL);
  const errorElement = await page.getByTestId(
    'id-small-loan-calculator-field-error',
  );
  await expect(errorElement).toHaveText('Oops, something went wrong');
});

function calculateMonthlyPayment(
  amount: number,
  period: number,
  annualPercent: number,
): number {
  const monthlyRate = annualPercent / 12 / 100;
  const payment =
    (amount * (monthlyRate * Math.pow(1 + monthlyRate, period))) /
    (Math.pow(1 + monthlyRate, period) - 1);
  return Math.round(payment * 100) / 100;
}

test('Server error in response', async ({ page }) => {
  const routeToMock = '**/api/loan-calc?amount=*&period=*';

  await page.route(routeToMock, async (route: Route) => {
    await route.fulfill({
      status: 500,
    });
  });

  const responsePromise = page.waitForResponse(routeToMock);

  await page.goto(serviceURL);
  await responsePromise;

  const errorElement = await page.getByTestId(
    'id-small-loan-calculator-field-error',
  );
  await expect(errorElement).toHaveText('Oops, something went wrong');
});

test('Successful fulfillment of the main flow', async ({ page }) => {
  const routeToMock = '**/api/loan-calc?amount=*&period=*';

  await page.route(routeToMock, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '',
    });
  });

  const responsePromise = page.waitForResponse(routeToMock);

  await page.goto(serviceURL);
  await responsePromise;

  await page.getByTestId('id-small-loan-calculator-field-apply').click();
  await page.getByTestId('login-popup-username-input').fill('usern');
  await page.getByTestId('login-popup-password-input').fill('pwd');
  await page.getByTestId('login-popup-continue-button').click();
  await page.getByTestId('final-page-continue-button').click();

  const popupOverlay = page.locator('.popup-overlay');
  await expect(popupOverlay).toBeVisible();
  await expect(popupOverlay).toContainText('Success!');
});

test('Successful fulfillment of the main flow with the wrong key in body', async ({
  page,
}) => {
  const routeToMock = '**/api/loan-calc?amount=*&period=*';

  await page.route(routeToMock, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ wrongKey: 456.78 }),
    });
  });

  const responsePromise = page.waitForResponse(routeToMock);

  await page.goto(serviceURL);
  await responsePromise;

  await page.getByTestId('id-small-loan-calculator-field-apply').click();
  await page.getByTestId('login-popup-username-input').fill('usern');
  await page.getByTestId('login-popup-password-input').fill('pwd');
  await page.getByTestId('login-popup-continue-button').click();
  await page.getByTestId('final-page-continue-button').click();

  const popupOverlay = page.locator('.popup-overlay');
  await expect(popupOverlay).toBeVisible();
  await expect(popupOverlay).toContainText('Success!');
});

test('By the loan amount 500 Euros and Period 12 months, monthly payment is 42.8', async ({
  page,
}) => {
  const routeToMock = '**/api/loan-calc?amount=*&period=*';

  await page.route(routeToMock, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ paymentAmountMonthly: 42.8 }),
    });
  });

  const responsePromise = page.waitForResponse(routeToMock);

  await page.goto(serviceURL);
  await responsePromise;

  await page.getByTestId('id-small-loan-calculator-field-apply').click();
  await page.getByTestId('login-popup-username-input').fill('usern');
  await page.getByTestId('login-popup-password-input').fill('pwd');
  await page.getByTestId('login-popup-continue-button').click();

  const monthlyPayment = page.getByTestId('final-page-monthly-payment');
  await expect(monthlyPayment).toBeVisible();
  await expect(monthlyPayment).toContainText('42.8 €');
});
