# upi-sms — supported formats

| Bank / sender | Format basis | Status |
|---|---|---|
| HDFC (`*-HDFCBK`) | Synthetic, from publicly known SMS wording | ⚠️ unverified |
| SBI (`*-SBIINB`) | Synthetic | ⚠️ unverified |
| ICICI (`*-ICICIB`) | Synthetic | ⚠️ unverified |
| Paytm Payments Bank (`*-PYTMBK`) | Synthetic | ⚠️ unverified |

Bank SMS templates are DLT-registered and change rarely — this is why the SMS
parser is built first (PRD §6). Still: every row above needs a real anonymized
sample before the pilot. Update this table when a real capture lands.
