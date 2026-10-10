export function BrandLockup({compact=false}:{compact?:boolean}){
 return <span className={'kk-logo-lockup'+(compact?' compact':'')} aria-label="Adela's Purchasing Agent">
  <svg className="kk-logo-art" viewBox="0 0 280 124" role="img" aria-hidden="true">
   <text x="140" y="74" textAnchor="middle" fill="#146a5e" fontFamily="Georgia, serif" fontSize="76" fontWeight="700">Adela's</text>
   <text x="140" y="112" textAnchor="middle" fill="#146a5e" fontFamily="Arial, sans-serif" fontSize="26" fontWeight="700" letterSpacing="5">代購</text>
  </svg>
 </span>;
}
