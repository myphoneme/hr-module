import { Document, Page, Text, View, Image } from '@react-pdf/renderer';
import { styles } from './styles';
import { LetterHeader, PageFooter, type LetterheadData } from './SharedComponents';

interface ShortFormTemplateProps {
  letterContent: any;
}

export function ShortFormTemplate({ letterContent }: ShortFormTemplateProps) {
  const {
    header,
    date,
    to,
    address,
    subject,
    body,
    signature,
    signatory,
    secondarySignatory,
    letterhead,
  } = letterContent;

  // Cast letterhead to proper type
  const letterheadData: LetterheadData | null = letterhead || null;

  return (
    <Document>
      {/* Single Page Offer Letter */}
      <Page size="A4" style={styles.page}>
        <LetterHeader showTitle={true} title={header || 'OFFER LETTER'} letterhead={letterheadData} />

        {/* Date on right */}
        <View style={{ alignItems: 'flex-end', marginBottom: 15 }}>
          <Text style={{ fontSize: 10 }}>Date: {date}</Text>
        </View>

        {/* To Section */}
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 10, marginBottom: 2 }}>To,</Text>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{to}</Text>
          <Text style={{ fontSize: 10 }}>{address}</Text>
        </View>

        {/* Subject Line - Orange */}
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 10, color: '#E55300', textDecoration: 'underline' }}>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>Subject: </Text>
            {subject}
          </Text>
        </View>

        {/* Greeting */}
        <View style={{ marginBottom: 5 }}>
          <Text style={{ fontSize: 10 }}>Dear {to.split(' ')[0]},</Text>
        </View>

        {/* Congratulations */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>Congratulations!</Text>
        </View>

        {/* Opening Paragraph */}
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 10, lineHeight: 1.4 }}>
            This is with reference to your application and subsequent interview held with Phoneme Solutions Pvt. Ltd.. We are pleased to offer you as "{subject.replace('Offer for the post of ', '')}" in our organization on the following terms and conditions.
          </Text>
        </View>

        {/* Numbered Sections */}
        <View style={{ marginBottom: 6 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>1. Commencement of Employment:</Text>
          <Text style={{ fontSize: 10 }}>Your joining date is {body.joiningDate}.</Text>
        </View>

        <View style={{ marginBottom: 6 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>2. Remuneration:</Text>
          <Text style={{ fontSize: 10 }}>
            Your total annual compensation would be INR {body.ctcFormatted}/- ({body.ctcInWords}) per annum. CTC Breakup is provided in Annexure A.
          </Text>
        </View>

        <View style={{ marginBottom: 6 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>3. Place of Work:</Text>
          <Text style={{ fontSize: 10 }}>Your place of work will be {body.workingLocation || 'Delhi'}.</Text>
        </View>

        <View style={{ marginBottom: 6 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>4. Working Hours:</Text>
          <Text style={{ fontSize: 10 }}>
            Your working hours will be 9:00 am to 06:00 pm. As per current company policy, you need to complete 9 hours in a day. The company observes a 5-day work week, with Saturday and Sunday as weekly off.
          </Text>
        </View>

        <View style={{ marginBottom: 6 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>5. Probation Period:</Text>
          <Text style={{ fontSize: 10 }}>
            You will be on probation for six months. Based on your performance, your services will be confirmed with the company in writing after six months.
          </Text>
        </View>

        <View style={{ marginBottom: 6 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>6. Notice Period:</Text>
          <Text style={{ fontSize: 10 }}>
            This appointment may be terminated by either side by giving thirty days notice or one month's salary in lieu of notice period.
          </Text>
        </View>

        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#E55300' }}>7. Confidentiality:</Text>
          <Text style={{ fontSize: 10 }}>
            During your employment with the company and thereafter, you will hold in strictest confidence all proprietary information and trade secrets of the company.
          </Text>
        </View>

        {/* Acceptance Deadline */}
        <View style={{ marginBottom: 8 }}>
          <Text style={{ fontSize: 10 }}>
            Please accept this offer by signing and returning the acceptance copy on or before {body.offerValidDate}, failing which this offer stands cancelled.
          </Text>
        </View>

        {/* Closing */}
        <View style={{ marginBottom: 15 }}>
          <Text style={{ fontSize: 10 }}>
            We welcome you to the Phoneme Solutions family and wish you a successful career with us.
          </Text>
        </View>

        {/* Regards and Signatures */}
        <View>
          <Text style={{ fontSize: 10, marginBottom: 3 }}>Regards,</Text>
          <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 15 }}>For Phoneme Solutions Pvt. Ltd..</Text>

          {/* Two Signatures Side by Side */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {/* Left - HR Manager */}
            <View style={{ width: '45%' }}>
              {signatory?.signature && signatory.signature.startsWith('data:') ? (
                <Image
                  src={signatory.signature}
                  style={{ width: 80, height: 40, objectFit: 'contain', marginBottom: 5 }}
                />
              ) : (
                <Text style={{ fontFamily: 'Helvetica-Oblique', fontSize: 12, marginBottom: 5 }}>
                  {signatory?.name || signature.name}
                </Text>
              )}
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{signatory?.name || signature.name}</Text>
              <Text style={{ fontSize: 10 }}>{signatory?.position || signature.title}</Text>
            </View>

            {/* Right - Director */}
            <View style={{ width: '45%', alignItems: 'flex-end' }}>
              {secondarySignatory?.stamp && secondarySignatory.stamp.startsWith('data:') ? (
                <Image
                  src={secondarySignatory.stamp}
                  style={{ width: 60, height: 60, objectFit: 'contain', marginBottom: 5 }}
                />
              ) : secondarySignatory?.signature && secondarySignatory.signature.startsWith('data:') ? (
                <Image
                  src={secondarySignatory.signature}
                  style={{ width: 80, height: 40, objectFit: 'contain', marginBottom: 5 }}
                />
              ) : (
                <View style={{ height: 40, marginBottom: 5 }} />
              )}
              <Text style={{ fontSize: 10, fontFamily: 'Helvetica-Bold' }}>{secondarySignatory?.name || 'Director'}</Text>
              <Text style={{ fontSize: 10 }}>{secondarySignatory?.position || 'Director'}</Text>
            </View>
          </View>
        </View>

        <PageFooter letterhead={letterheadData} />
      </Page>
    </Document>
  );
}
