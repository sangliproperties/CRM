import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT || 465),
  secure: (process.env.SMTP_SECURE || "true") === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOwnerPropertyRegistrationEmail(opts: {
  to: string;
  ownerName?: string | null;
}) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER;

  const subject = "सांगली प्रॉपर्टीज एल. एल. पी. कडे प्रॉपर्टी नोंदणीची पुष्टी";

  const ownerLine = opts.ownerName ? `आदरणीय ${opts.ownerName} महोदय/महोदया ,` : "आदरणीय महोदय/महोदया ,";

  const text = `${ownerLine}

सांगली प्रॉपर्टीज एल. एल. पी. कडून नमस्कार ,

आपल्याला कळविण्यात आनंद होत आहे की आपल्या प्रॉपर्टीची माहिती यशस्वीरित्या सांगली प्रॉपर्टीज एल.एल.पी. कडे नोंदणीकृत करण्यात आली आहे. आपली प्रॉपर्टी आता आमच्या अधिकृत नोंदींमध्ये समाविष्ट असून, आपल्या गरजेनुसार ती संभाव्य खरेदीदार/भाडेकरूंना सादर केली जाईल.

आमच्याकडे प्रॉपर्टी नोंदणी करून, आपण आमच्या अटी व शर्ती तसेच लागू असलेल्या कमिशन साठी मान्य असून ते समजून घेऊन त्यास संमती दिली आहे, याची आपण खात्री देता, असे समजण्यात येईल.

योग्य चौकशी प्राप्त झाल्यास आमची टीम आपल्याशी संपर्क साधेल. दरम्यान, आपल्याला कोणतीही माहिती अद्ययावत करायची असल्यास किंवा काही प्रश्न असल्यास कृपया आमच्याशी निःसंकोच संपर्क साधावा.

सांगली प्रॉपर्टीज एल. एल. पी. वर विश्वास ठेवल्याबद्दल धन्यवाद. आपला मालमत्ता व्यवहार सुरळीत व यशस्वी करण्यासाठी आम्ही सदैव तत्पर आहोत.

आपला नम्र,
सांगली प्रॉपर्टीज एल. एल. पी.
रिअल इस्टेट व प्रॉपर्टी सल्लागार
संपर्क : 9156037011
ई-मेल : rajeshtunge@gmail.com`;

  await transporter.sendMail({
    from,
    to: opts.to,
    subject,
    text,
  });
}
