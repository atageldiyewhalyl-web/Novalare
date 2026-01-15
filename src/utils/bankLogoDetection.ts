import chaseLogoSrc from 'figma:asset/71d280b00ecffd822b0665ebfac030b7be8eff5f.png';
import boaLogoSrc from 'figma:asset/161c097f23e4a7e0ece641c4e788a3d33e033cbd.png';
import capitalOneLogoSrc from 'figma:asset/c4c1e5d724add646a2dde43f03eb33725914cbba.png';
import wellsFargoLogoSrc from 'figma:asset/66f0ee6d48d08ff6c26e7c7ed0b37fe0540d41c1.png';
import citiLogoSrc from 'figma:asset/a9062db36b0a11a166a24f741d4062b5b4210b94.png';
import pncLogoSrc from 'figma:asset/4421786373414de493adbda29bde48cc6db5138e.png';
import truistLogoSrc from 'figma:asset/5ee23d91d373cc04fc5608849313026ff0515ceb.png';
import tdBankLogoSrc from 'figma:asset/f439fa73d3abe4983007f313ec6b66c432263083.png';
import amexLogoSrc from 'figma:asset/669c9a48bd32ed06be2813cce6f423da8cbc40d1.png';

export interface BankInfo {
  name: string;
  logo: string;
  keywords: string[];
}

// Bank logo registry with detection keywords
export const BANK_REGISTRY: BankInfo[] = [
  {
    name: 'Chase',
    logo: chaseLogoSrc,
    keywords: ['chase', 'jpmorgan', 'jp morgan'],
  },
  {
    name: 'Bank of America',
    logo: boaLogoSrc,
    keywords: ['bank of america', 'bofa', 'boa', 'bankofamerica'],
  },
  {
    name: 'Capital One',
    logo: capitalOneLogoSrc,
    keywords: ['capital one', 'capitalone', 'capital1'],
  },
  {
    name: 'Wells Fargo',
    logo: wellsFargoLogoSrc,
    keywords: ['wells fargo', 'wellsfargo', 'wells'],
  },
  {
    name: 'Citibank',
    logo: citiLogoSrc,
    keywords: ['citi', 'citibank', 'citicorp'],
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
    name: 'American Express',
    logo: amexLogoSrc,
    keywords: ['amex', 'american express', 'americanexpress'],
  },
  {
    name: 'US Bank',
    logo: '', // Can be added later
    keywords: ['us bank', 'usbank', 'u.s. bank'],
  },
];

/**
 * Detects which bank an account belongs to based on the account name
 * @param accountName - The name of the bank account (e.g., "Chase Checking")
 * @returns BankInfo object if detected, null otherwise
 */
export function detectBankFromName(accountName: string): BankInfo | null {
  if (!accountName) return null;

  const normalizedName = accountName.toLowerCase().trim();

  // Find the first bank whose keywords match the account name
  for (const bank of BANK_REGISTRY) {
    for (const keyword of bank.keywords) {
      if (normalizedName.includes(keyword.toLowerCase())) {
        // Only return if the bank has a logo
        if (bank.logo) {
          return bank;
        }
      }
    }
  }

  return null;
}

/**
 * Gets the bank logo URL from an account name
 * @param accountName - The name of the bank account
 * @returns Logo URL string if detected, null otherwise
 */
export function getBankLogo(accountName: string): string | null {
  const bankInfo = detectBankFromName(accountName);
  return bankInfo?.logo || null;
}