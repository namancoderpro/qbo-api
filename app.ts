import express, { Request, Response } from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
let accessToken: string;
let refreshToken: string;
let BASE_URL = `https://sandbox-quickbooks.api.intuit.com/v3/company/`;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json()); // Add this line to handle JSON body parsing

// Step 1: Redirect to QuickBooks Authorization URL
app.get('/auth', (req: Request, res: Response) => {
    const redirectUri = encodeURIComponent(process.env.REDIRECT_URI!);
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${process.env.CLIENT_ID}&response_type=code&scope=com.intuit.quickbooks.accounting&redirect_uri=${redirectUri}&state=demo-app`;
    res.redirect(authUrl);
});

// Step 2: Handle Callback and Retrieve Access Token
app.get('/callback', async (req: Request, res: Response) => {
    const authCode = req.query.code as string;
    const realmId = req.query.realmId as string;
    BASE_URL = `https://sandbox-quickbooks.api.intuit.com/v3/company/${realmId}`;

    if (!authCode) {
        return res.status(400).send('No authorization code received');
    }

    console.log(authCode, realmId)

    const requestBody = new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: process.env.REDIRECT_URI!,
    }).toString();

    try {
        const response = await axios.post(
            'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
            requestBody,
            {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Basic ${Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                } 
            }
        );

        accessToken = response.data.access_token;
        refreshToken = response.data.refresh_token;

        res.json({ accessToken, refreshToken });

        console.log(accessToken, refreshToken)
    } catch (error) {
        console.error('Error retrieving access token:', error);
        res.status(500).send('Error during token retrieval');
    }
});

app.get('/create-account', async (req: Request, res: Response) => {
    const accountData = {
            "Name":"Test_Account_Updated",
            "SubAccount":false,
            "FullyQualifiedName":"Test_Account_Updated",
            "Active":true,
            "Classification":"Asset",
            "AccountType":"Accounts Receivable",
            "AccountSubType":"AccountsReceivable",
            "CurrentBalance":0,
            "CurrentBalanceWithSubAccounts":0,
            "CurrencyRef":{"value":"USD","name":"United States Dollar"},
            "domain":"QBO",
            "sparse":false,
            "Id":"91",
            "SyncToken":"0",
            "MetaData":{"CreateTime":"2024-08-12T09:37:38-07:00","LastUpdatedTime":"2024-08-12T09:37:38-07:00"},
        }

    try {
        const response = await axios.post(
            `${BASE_URL}/account`,
            accountData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            }
        );
        res.status(201).json(response.data);
    } catch (error: any) {
        console.error('Error creating account:', error.message);
        res.status(500).send('Error creating account');
    }
})


app.get('/create-invoice', async (req: Request, res: Response) => {
    const invoiceData = {
        "CustomerRef": {
            "value": "1" // Replace with the appropriate customer ID
        },
        "Line": [
            {
                "Amount": 100.00, // The total amount for this line item
                "DetailType": "SalesItemLineDetail",
                "SalesItemLineDetail": {
                    "ItemRef": {
                        "value": "1", // Replace with the appropriate item ID
                        "name": "Item Name"
                    },
                    "UnitPrice": 100.00, // Price for a single unit of the item
                    "Qty": 1 // Quantity of the item
                }
            }
        ],
        "BillAddr": { // Optional billing address details
            "Line1": "123 Main St",
            "City": "Anytown",
            "CountrySubDivisionCode": "CA", // State abbreviation
            "PostalCode": "12345" // Postal code
        },
        "CurrencyRef": {
            "value": "USD" // Currency code for the invoice
        }
    };

    try {
        const response = await axios.post(
            `${BASE_URL}/invoice`,
            invoiceData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            }
        );

        res.status(201).json(response.data);
    } catch (error: any) {
        console.error('Error creating invoice:', error.response.data);
        res.status(500).send('Error creating invoice');
    }
});

app.get('/get-invoice/:invoiceId', async (req: Request, res: Response) => {
    const { invoiceId } = req.params; // Get invoice ID from request parameters

    try {
        const response = await axios.get(
            `${BASE_URL}/invoice/${invoiceId}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            }
        );

        res.status(200).json(response.data);
    } catch (error: any) {
        console.error('Error retrieving invoice:', error.response.data);
        res.status(500).send('Error retrieving invoice');
    }
});


app.get('/update-invoice', async (req: Request, res: Response) => {
    const invoiceData = {
        "Id": "145", // Replace with the invoice ID you want to update
        "SyncToken": "0", // Must be the current SyncToken for the invoice
        "sparse": true,
        "Line": [
            {
                "Amount": 150.00, // Updated total amount for this line
                "DetailType": "SalesItemLineDetail",
                "SalesItemLineDetail": {
                    "ItemRef": {
                        "value": "1", // ID of the item
                        "name": "Updated Item Name" // Optional updated item name
                    },
                    "UnitPrice": 150.00, // New price per unit
                    "Qty": 1 // Quantity remains the same
                }
            }
        ]
    };

    try {
        const response = await axios.post(
            `${BASE_URL}/invoice`,
            invoiceData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            }
        );

        res.status(200).json(response.data);
    } catch (error: any) {
        console.error('Error updating invoice:', error.response.data);
        res.status(500).send('Error updating invoice');
    }
});


app.get('/create-bill', async (req: Request, res: Response) => {
    const billData = {
        "VendorRef": {
            "value": "56" 
        },
        "Line": [
            {
                "Amount": 100.00, // The total amount for this line item
                "DetailType": "AccountBasedExpenseLineDetail", // Specifies the type of line item
                "AccountBasedExpenseLineDetail": {
                    "AccountRef": {
                        "value": "7",                    
                        },
                }
            }
        ],
        "CurrencyRef": {
            "value": "USD" // Currency code for the bill
        }
    };

    try {
        const response = await axios.post(
            `${BASE_URL}/bill`,
            billData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            }
        );

        res.status(201).json(response.data);
    } catch (error: any) {
        console.error('Error creating bill:', error.response.data);
        res.status(500).send('Error creating bill');
    }
});

app.get('/create-transfer', async (req: Request, res: Response) => {
    const transferData = {
        "FromAccountRef": {
            "value": "1" // Replace with the source account ID
        },
        "ToAccountRef": {
            "value": "2" // Replace with the destination account ID
        },
        "Amount": 100.00, // Amount to be transferred
        "TxnDate": "2024-01-01" // Date of the transfer
    };

    try {
        const response = await axios.post(
            `${BASE_URL}/transfer`,
            transferData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            }
        );

        res.status(201).json(response.data);
    } catch (error: any) {
        console.error('Error creating transfer:', error.response.data);
        res.status(500).send('Error creating transfer');
    }
});


app.get('/create-vendor', async (req: Request, res: Response) => {
    const vendorData = {
        "DisplayName": "Vendor Name", // Required: Name of the vendor
        "PrimaryEmailAddr": {
            "Address": "vendor@example.com" // Vendor's email address
        },
        "PrimaryPhone": {
            "FreeFormNumber": "(123) 456-7890" // Vendor's phone number
        },
        "BillAddr": { // Optional billing address details
            "Line1": "123 Vendor St",
            "City": "Vendor City",
            "CountrySubDivisionCode": "CA", // State abbreviation
            "PostalCode": "12345" // Postal code
        },
        "Suffix": "Sr. ",
        "Title": "Mr. ",
        "GivenName": "Example 1", 
        "PrintOnCheckName": "Example Vendor Name"
    };

    try {
        const response = await axios.post(
            `${BASE_URL}/vendor`,
            vendorData,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
            }
        );

        res.status(201).json(response.data);
    } catch (error: any) {
        console.error('Error creating vendor:', error.response.data);
        res.status(500).send('Error creating vendor');
    }
});


// app.get('/get-bill/:billId', async (req: Request, res: Response) => {
//     const { billId } = req.params; // Get bill ID from request parameters

//     try {
//         const response = await axios.get(
//             `${BASE_URL}/bill/${billId}`,
//             {
//                 headers: {
//                     'Authorization': `Bearer ${accessToken}`,
//                     'Content-Type': 'application/json',
//                     'Accept': 'application/json',
//                 },
//             }
//         );

//         res.status(200).json(response.data);
//     } catch (error: any) {
//         console.error('Error retrieving bill:', error.response.data);
//         res.status(500).send('Error retrieving bill');
//     }
// });


// app.get('/update-bill', async (req: Request, res: Response) => {
//     const billData = {"DueDate":"2024-08-12","Balance":100,"domain":"QBO","sparse":false,"Id":"146","SyncToken":"0","MetaData":{"CreateTime":"2024-08-12T11:55:24-07:00","LastUpdatedTime":"2024-08-12T11:55:24-07:00"},"TxnDate":"2024-08-12","CurrencyRef":{"value":"USD","name":"United States Dollar"},"Line":[{"Id":"1","LineNum":1,"Amount":150,"DetailType":"AccountBasedExpenseLineDetail","AccountBasedExpenseLineDetail":{"AccountRef":{"value":"7","name":"Advertising"},"BillableStatus":"NotBillable","TaxCodeRef":{"value":"NON"}}}],"VendorRef":{"value":"56","name":"Bob's Burger Joint"},"APAccountRef":{"value":"33","name":"Accounts Payable (A/P)"},"TotalAmt":100}

//     try {
//         const response = await axios.post(
//             `${BASE_URL}/bill`,
//             billData,
//             {
//                 headers: {
//                     'Authorization': `Bearer ${accessToken}`,
//                     'Content-Type': 'application/json',
//                     'Accept': 'application/json',
//                 },
//             }
//         );

//         res.status(200).json(response.data);
//     } catch (error: any) {
//         console.error('Error updating bill:', error.response.data);
//         res.status(500).send('Error updating bill');
//     }
// });


// app.get('/create-payment', async (req: Request, res: Response) => {
//     const paymentData = {
//         "CustomerRef": {
//             "value": "1" // Replace with the appropriate customer ID
//         },
//         "TotalAmt": 100,
//         "Line": [
//             {
//                 "Amount": 100.00, // Total payment amount for this line
//                 "LinkedTxn": [
//                     {
//                         "TxnId": "145", // Replace with the ID of the invoice being paid
//                         "TxnType": "Invoice" // The type of transaction
//                     }
//                 ]
//             }
//         ],
//         "CurrencyRef": {
//             "value": "USD" // Currency code for the payment
//         }
//     };

//     try {
//         const response = await axios.post(
//             `${BASE_URL}/payment`,
//             paymentData,
//             {
//                 headers: {
//                     'Authorization': `Bearer ${accessToken}`,
//                     'Content-Type': 'application/json',
//                     'Accept': 'application/json',
//                 },
//             }
//         );

//         res.status(201).json(response.data);
//     } catch (error: any) {
//         console.error('Error creating payment:', error.response.data);
//         res.status(500).send('Error creating payment');
//     }
// });


async function refreshAccessToken() {
    if (!refreshToken) {
        console.error('No refresh token available to refresh access token');
        return;
    }

    const requestBody = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    }).toString();

    try {
        const response = await axios.post(
            'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
            requestBody,
            {
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Basic ${Buffer.from(`${process.env.CLIENT_ID}:${process.env.CLIENT_SECRET}`).toString('base64')}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );

        // Store the new access and refresh tokens
        accessToken = response.data.access_token;
        refreshToken = response.data.refresh_token;

        console.log('Access token refreshed:', accessToken);
        console.log('Refresh token:', refreshToken);

        // Here, store the new tokens in your database or persistent storage if needed
    } catch (error) {
        console.error('Error refreshing access token:', error);
    }
}


setInterval(refreshAccessToken, 3600000); // Run every 60 minutes (3600 seconds)


// Start the Express server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
