import amexLogoSrc from 'figma:asset/669c9a48bd32ed06be2813cce6f423da8cbc40d1.png';
import chaseLogoSrc from 'figma:asset/71d280b00ecffd822b0665ebfac030b7be8eff5f.png';
import boaLogoSrc from 'figma:asset/161c097f23e4a7e0ece641c4e788a3d33e033cbd.png';
import capitalOneLogoSrc from 'figma:asset/c4c1e5d724add646a2dde43f03eb33725914cbba.png';
import wellsFargoLogoSrc from 'figma:asset/66f0ee6d48d08ff6c26e7c7ed0b37fe0540d41c1.png';
import citiLogoSrc from 'figma:asset/a9062db36b0a11a166a24f741d4062b5b4210b94.png';
import pncLogoSrc from 'figma:asset/4421786373414de493adbda29bde48cc6db5138e.png';
import truistLogoSrc from 'figma:asset/5ee23d91d373cc04fc5608849313026ff0515ceb.png';
import tdBankLogoSrc from 'figma:asset/f439fa73d3abe4983007f313ec6b66c432263083.png';

export interface CreditCardInfo {
  name: string;
  logo: string;
  keywords: string[];
}

// Credit card logo registry with detection keywords
export const CREDIT_CARD_REGISTRY: CreditCardInfo[] = [
  {
    name: 'American Express',
    logo: amexLogoSrc,
    keywords: ['amex', 'american express', 'americanexpress', 'green card', 'gold card', 'platinum card'],
  },
  {
    name: 'Chase',
    logo: chaseLogoSrc,
    keywords: ['chase', 'jpmorgan', 'jp morgan', 'sapphire', 'freedom', 'ink'],
  },
  {
    name: 'Bank of America',
    logo: boaLogoSrc,
    keywords: ['bank of america', 'bofa', 'boa', 'bankofamerica'],
  },
  {
    name: 'Capital One',
    logo: capitalOneLogoSrc,
    keywords: ['capital one', 'capitalone', 'capital1', 'venture', 'quicksilver', 'savor'],
  },
  {
    name: 'Wells Fargo',
    logo: wellsFargoLogoSrc,
    keywords: ['wells fargo', 'wellsfargo', 'wells'],
  },
  {
    name: 'Citibank',
    logo: citiLogoSrc,
    keywords: ['citi', 'citibank', 'citicorp', 'costco'],
  },
  {
    name: 'PNC Bank',
    logo: pncLogoSrc,
    keywords: ['pnc', 'pnc bank'],
  },
  {
    name: 'Truist',
    logo: truistLogoSrc,
    keywords: ['truist', 'suntrust', 'bb&t'],
  },
  {
    name: 'TD Bank',
    logo: tdBankLogoSrc,
    keywords: ['td bank', 'tdbank', 'td'],
  },
  {
    name: 'Discover',
    logo: '', // Can be added later
    keywords: ['discover', 'discover it', 'discoverit'],
  },
  {
    name: 'US Bank',
    logo: '', // Can be added later
    keywords: ['us bank', 'usbank', 'u.s. bank'],
  },
  {
    name: 'Visa',
    logo: '', // Generic Visa cards
    keywords: ['visa'],
  },
  {
    name: 'Mastercard',
    logo: '', // Generic Mastercard
    keywords: ['mastercard', 'master card'],
  },
];

/**
 * Detects which credit card an account belongs to based on the account name
 * @param accountName - The name of the credit card account (e.g., "AmEx Green Card")
 * @returns CreditCardInfo object if detected, null otherwise
 */
export function detectCreditCardFromName(accountName: string): CreditCardInfo | null {
  if (!accountName) return null;

  const normalizedName = accountName.toLowerCase().trim();

  // Find the first credit card whose keywords match the account name
  for (const card of CREDIT_CARD_REGISTRY) {
    for (const keyword of card.keywords) {
      if (normalizedName.includes(keyword.toLowerCase())) {
        // Only return if the card has a logo
        if (card.logo) {
          return card;
        }
      }
    }
  }

  return null;
}

/**
 * Gets the credit card logo URL from an account name
 * @param accountName - The name of the credit card account
 * @returns Logo URL string if detected, null otherwise
 */
export function getCreditCardLogo(accountName: string): string | null {
  const cardInfo = detectCreditCardFromName(accountName);
  return cardInfo?.logo || null;
}
