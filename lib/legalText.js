// Textos de los Términos y Condiciones y de la Política de Tratamiento de Datos Personales.
// La versión en español es la que rige; la inglesa es una traducción de cortesía.
// Formato: cada sección tiene un título y una lista de párrafos; un párrafo puede ser { list: [...] }.

import { CONTROLLER as C } from "@/lib/legal";

const ES_DATE = "24 de octubre de 2026";
const EN_DATE = "October 24, 2026";

export const LEGAL_TEXT = {
  es: {
    note: null,
    terms: {
      title: "Términos y Condiciones de uso",
      updated: `Versión vigente desde el ${ES_DATE}`,
      sections: [
        {
          title: "1. Quiénes somos",
          body: [
            `${C.brand} es una plataforma de entrenamiento en línea operada por ${C.name}, ${C.type} con domicilio en ${C.city} (en adelante, "el Coach" o "${C.brand}"). Puede escribirnos a ${C.email} o al ${C.phone}.`,
            `Al crear una cuenta o usar ${C.brand} usted acepta estos Términos. Si no está de acuerdo, no use la plataforma.`,
          ],
        },
        {
          title: "2. El servicio",
          body: [
            `${C.brand} permite que el Coach le asigne rutinas de entrenamiento y planes, y que usted registre sus entrenamientos, peso, comidas, medidas, fotos de progreso y check-ins semanales, y se comunique con el Coach por mensajes.`,
            "Las recomendaciones de nutrición que muestra la app (calorías y proteína) son estimaciones generales y orientativas.",
          ],
        },
        {
          title: "3. No es un servicio médico",
          body: [
            `${C.brand} ofrece orientación de entrenamiento físico. No presta servicios médicos, de fisioterapia ni de nutrición clínica, y no reemplaza el diagnóstico ni el tratamiento de un profesional de la salud.`,
            {
              list: [
                "Consulte a su médico antes de empezar si tiene una enfermedad, lesión, embarazo, toma medicamentos o lleva tiempo sin hacer ejercicio.",
                "Detenga el ejercicio y busque atención si siente dolor en el pecho, mareo, falta de aire inusual o dolor fuerte.",
                "Informe al Coach de forma veraz y oportuna cualquier lesión, condición o cambio en su salud.",
              ],
            },
          ],
        },
        {
          title: "4. Su cuenta",
          body: [
            "Debe dar información verdadera, mantener su contraseña en secreto y no compartir su cuenta. Cada cuenta es personal.",
            "La plataforma es para mayores de 18 años. Las personas desde los 12 años pueden usarla solo con la autorización de su padre, madre o representante legal, quien acepta estos Términos en su nombre y supervisa el uso.",
          ],
        },
        {
          title: "5. Acceso y pagos",
          body: [
            `El acceso a ${C.brand} lo habilita el Coach por el periodo que acuerde con usted. Los pagos no se hacen dentro de la app: el valor, la forma de pago, la duración y las condiciones de cambio o devolución se acuerdan directamente con el Coach.`,
            "Cuando el acceso vence, usted no puede ver sus rutinas hasta que el Coach lo renueve, pero su información se conserva según la Política de Tratamiento de Datos.",
          ],
        },
        {
          title: "6. Uso permitido",
          body: [
            {
              list: [
                "Usar la plataforma solo para su entrenamiento personal.",
                "No publicar contenido ofensivo, ilegal o que vulnere derechos de otras personas en mensajes o fotos.",
                "No intentar acceder a cuentas o datos de otras personas, ni afectar el funcionamiento o la seguridad de la plataforma.",
                "No copiar, vender ni distribuir las rutinas, planes o contenidos del Coach.",
              ],
            },
          ],
        },
        {
          title: "7. Propiedad intelectual",
          body: [
            `Las rutinas, planes, textos, la marca ${C.brand}, el logo y el diseño de la plataforma pertenecen al Coach o se usan con autorización. Se le permite usarlos solo para su entrenamiento personal.`,
            "Lo que usted sube (fotos, mensajes, registros) sigue siendo suyo. Usted autoriza al Coach a usarlo únicamente para prestarle el servicio.",
          ],
        },
        {
          title: "8. Disponibilidad",
          body: [
            "Trabajamos para que la plataforma funcione siempre, pero puede haber interrupciones por mantenimiento, fallas técnicas o de los proveedores. Podemos agregar, cambiar o retirar funciones.",
          ],
        },
        {
          title: "9. Responsabilidad",
          body: [
            "Usted realiza los ejercicios de forma voluntaria y siguiendo las indicaciones recibidas. El Coach no responde por daños causados por no seguir las indicaciones, por no informar condiciones de salud o lesiones, o por usar información falsa.",
            "Nada de lo anterior limita los derechos que la ley colombiana le reconoce como consumidor (Ley 1480 de 2011).",
          ],
        },
        {
          title: "10. Suspensión y eliminación de la cuenta",
          body: [
            "Usted puede eliminar su cuenta cuando quiera desde Perfil → Eliminar mi cuenta. El Coach puede suspender el acceso si se incumplen estos Términos.",
          ],
        },
        {
          title: "11. Datos personales",
          body: ["El tratamiento de sus datos se rige por la Política de Tratamiento de Datos Personales, que hace parte de estos Términos."],
        },
        {
          title: "12. Cambios",
          body: ["Si cambiamos estos Términos de forma importante, se lo informaremos en la app y le pediremos aceptarlos de nuevo."],
        },
        {
          title: "13. Ley aplicable y contacto",
          body: [
            "Estos Términos se rigen por las leyes de la República de Colombia. Cualquier diferencia se intentará resolver primero de forma directa; si no es posible, serán competentes los jueces de Medellín.",
            `Contacto: ${C.email} · teléfono y WhatsApp ${C.phone}.`,
          ],
        },
      ],
    },
    privacy: {
      title: "Política de Tratamiento de Datos Personales",
      updated: `Versión vigente desde el ${ES_DATE}`,
      sections: [
        {
          title: "1. Responsable del tratamiento",
          body: [
            `${C.name}, ${C.type}, con domicilio en ${C.city}, quien opera la plataforma ${C.brand}. Correo para todo lo relacionado con sus datos: ${C.email}. Teléfono y WhatsApp: ${C.phone}.`,
            "Esta Política se expide conforme a la Ley 1581 de 2012, el Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015) y demás normas que los modifiquen o complementen.",
          ],
        },
        {
          title: "2. Definiciones",
          body: [
            {
              list: [
                "Titular: la persona a quien se refieren los datos (usted).",
                "Dato personal: cualquier información que lo identifica o puede identificarlo.",
                "Dato sensible: el que afecta su intimidad o cuyo uso indebido puede generar discriminación, como los datos relativos a la salud.",
                "Tratamiento: cualquier operación sobre los datos, como recolectarlos, guardarlos, usarlos o eliminarlos.",
                "Encargado: quien trata datos por cuenta del Responsable (por ejemplo, el proveedor de la base de datos).",
                "Autorización: su consentimiento previo, expreso e informado.",
              ],
            },
          ],
        },
        {
          title: "3. Datos que tratamos",
          body: [
            {
              list: [
                "Identificación y contacto: nombre, correo electrónico, fecha de nacimiento, foto de perfil e idioma.",
                "Entrenamiento: rutinas asignadas, ejercicios completados, series, pesos y repeticiones, progresión, insignias y actividad.",
                "Nutrición: peso, estatura, edad, sexo, nivel de actividad, objetivo, lugar de entrenamiento y comidas que registre.",
                "Datos sensibles de salud (solo si los autoriza): ficha de ingreso (lesiones, condiciones médicas, medicamentos y restricciones), dolor reportado en el check-in, medidas corporales y resultados calculados, y fotos de progreso corporal.",
                "Comunicaciones: mensajes con el Coach, check-ins semanales y respuestas.",
                "Datos del padre, madre o acudiente cuando el titular es menor de edad: nombre, tipo y número de documento, parentesco y correo.",
                "Datos técnicos necesarios para la seguridad: fecha y hora de inicio de sesión y tipo de navegador o dispositivo.",
              ],
            },
          ],
        },
        {
          title: "4. Finalidades",
          body: [
            "Sus datos se usan para:",
            {
              list: [
                "Crear y administrar su cuenta y controlar su acceso.",
                "Diseñar, ajustar y hacer seguimiento a su entrenamiento y a sus metas de nutrición.",
                "Cuidar su seguridad adaptando el entrenamiento a lesiones o condiciones que informe.",
                "Mostrarle su progreso, estadísticas, medidas e insignias.",
                "Comunicarnos con usted: mensajes, avisos y recordatorios dentro de la app y correos de la cuenta (por ejemplo, para recuperar la contraseña).",
                "Atender sus consultas y reclamos.",
                "Proteger la seguridad de la plataforma y prevenir fraudes.",
                "Cumplir obligaciones legales.",
              ],
            },
            "No vendemos sus datos ni los compartimos con terceros para publicidad.",
          ],
        },
        {
          title: "5. Datos sensibles de salud",
          body: [
            "Los datos de salud son datos sensibles. Solo se tratan si usted (o su representante, si es menor de edad) da la autorización expresa por separado, y solo para las finalidades de diseñar su entrenamiento, cuidar su seguridad y mostrarle su progreso.",
            "Usted no está obligado a autorizar el tratamiento de datos sensibles ni a responder preguntas sobre ellos. Si no lo autoriza, puede seguir usando la plataforma, pero no tendrá disponibles la ficha de salud, las medidas corporales, las fotos de progreso ni el reporte de dolor. Puede dar o retirar esta autorización cuando quiera desde Perfil → Privacidad.",
          ],
        },
        {
          title: "6. Niñas, niños y adolescentes",
          body: [
            "El tratamiento de datos de menores de 18 años respeta su interés superior y sus derechos fundamentales. Se requiere la autorización de su padre, madre o representante legal, quien la otorga al registrarse, y se tendrá en cuenta la opinión del menor según su madurez. El representante puede ejercer en cualquier momento los derechos del titular.",
          ],
        },
        {
          title: "7. Sus derechos",
          body: [
            "Como titular usted tiene derecho a:",
            {
              list: [
                "Conocer, actualizar y rectificar sus datos.",
                "Solicitar prueba de la autorización que otorgó.",
                "Ser informado sobre el uso que se da a sus datos.",
                "Presentar quejas ante la Superintendencia de Industria y Comercio, después de haber agotado el trámite de consulta o reclamo ante el Responsable.",
                "Revocar la autorización y pedir la supresión de sus datos cuando no exista un deber legal o contractual de conservarlos.",
                "Acceder gratis a sus datos.",
              ],
            },
            "Muchos de sus datos los puede ver y corregir directamente en la app, y puede eliminar su cuenta desde Perfil.",
          ],
        },
        {
          title: "8. Cómo ejercer sus derechos",
          body: [
            `Escriba a ${C.email} (o comuníquese al ${C.phone}) indicando su nombre, el correo de su cuenta, lo que solicita y, si es un reclamo, los hechos y los documentos que quiera hacer valer.`,
            {
              list: [
                "Consultas: se responden en máximo 10 días hábiles. Si no es posible, le informaremos el motivo y la nueva fecha, que no superará 5 días hábiles más.",
                "Reclamos (corrección, actualización, supresión o incumplimiento): se responden en máximo 15 días hábiles, prorrogables hasta 8 días hábiles más informándole el motivo. Si el reclamo está incompleto, le pediremos completarlo dentro de los 5 días siguientes; si pasan 2 meses sin respuesta, se entenderá que desistió.",
              ],
            },
          ],
        },
        {
          title: "9. Encargados y transferencia internacional",
          body: [
            "Para funcionar, la plataforma usa proveedores de tecnología que tratan los datos por cuenta del Responsable y bajo sus instrucciones: el servicio de base de datos, autenticación y almacenamiento de archivos (Supabase), el servicio de alojamiento web y el servicio de envío de correos. Sus servidores pueden estar ubicados fuera de Colombia, por ejemplo en Estados Unidos.",
            "Al aceptar esta Política usted autoriza la transmisión de sus datos a estos proveedores, únicamente para prestarle el servicio y con medidas de seguridad adecuadas.",
          ],
        },
        {
          title: "10. Seguridad",
          body: [
            "Aplicamos medidas como conexión cifrada (HTTPS), control de acceso por permisos (cada alumno solo ve su información y solo el Coach ve la de sus alumnos), almacenamiento privado de las fotos de progreso con enlaces temporales, y contraseñas que nadie puede ver.",
          ],
        },
        {
          title: "11. Conservación",
          body: [
            "Conservamos sus datos mientras tenga una cuenta. Si la elimina, borramos sus datos y archivos, salvo lo que debamos conservar por una obligación legal. El registro de las autorizaciones se conserva como prueba mientras pueda ser requerido.",
          ],
        },
        {
          title: "12. Vigencia y cambios",
          body: [
            `Esta Política rige desde el ${ES_DATE}. Las bases de datos estarán vigentes mientras se preste el servicio. Si la cambiamos de forma importante, se lo informaremos en la app y, cuando corresponda, le pediremos una nueva autorización.`,
          ],
        },
      ],
    },
  },

  en: {
    note: "This is a courtesy translation. The Spanish version is the legally binding one.",
    terms: {
      title: "Terms and Conditions of Use",
      updated: `Effective as of ${EN_DATE}`,
      sections: [
        {
          title: "1. Who we are",
          body: [
            `${C.brand} is an online training platform operated by ${C.name}, an individual (persona natural) domiciled in ${C.city} (the "Coach" or "${C.brand}"). You can reach us at ${C.email} or +57 ${C.phone}.`,
            `By creating an account or using ${C.brand} you accept these Terms. If you do not agree, please do not use the platform.`,
          ],
        },
        {
          title: "2. The service",
          body: [
            `${C.brand} lets the Coach assign you workouts and plans, and lets you log your workouts, weight, meals, measurements, progress photos and weekly check-ins, and message the Coach.`,
            "The nutrition figures shown in the app (calories and protein) are general, approximate estimates.",
          ],
        },
        {
          title: "3. Not a medical service",
          body: [
            `${C.brand} provides fitness training guidance. It does not provide medical, physical therapy or clinical nutrition services and does not replace diagnosis or treatment by a health professional.`,
            {
              list: [
                "See your doctor before starting if you have an illness, injury, pregnancy, take medication or have not exercised in a long time.",
                "Stop exercising and seek help if you feel chest pain, dizziness, unusual shortness of breath or strong pain.",
                "Tell the Coach truthfully and promptly about any injury, condition or change in your health.",
              ],
            },
          ],
        },
        {
          title: "4. Your account",
          body: [
            "You must provide true information, keep your password secret and not share your account. Each account is personal.",
            "The platform is for people 18 and older. People aged 12 and over may use it only with the authorization of their parent or legal guardian, who accepts these Terms on their behalf and supervises their use.",
          ],
        },
        {
          title: "5. Access and payments",
          body: [
            `Access to ${C.brand} is enabled by the Coach for the period agreed with you. Payments are not made in the app: price, payment method, duration and change or refund conditions are agreed directly with the Coach.`,
            "When access expires you cannot see your workouts until the Coach renews it, but your information is kept according to the Privacy Policy.",
          ],
        },
        {
          title: "6. Acceptable use",
          body: [
            {
              list: [
                "Use the platform only for your personal training.",
                "Do not post offensive or illegal content, or content that infringes other people's rights, in messages or photos.",
                "Do not try to access other people's accounts or data, or interfere with the platform's operation or security.",
                "Do not copy, sell or distribute the Coach's workouts, plans or content.",
              ],
            },
          ],
        },
        {
          title: "7. Intellectual property",
          body: [
            `Workouts, plans, texts, the ${C.brand} brand, logo and platform design belong to the Coach or are used with permission. You may use them only for your personal training.`,
            "What you upload (photos, messages, logs) remains yours. You authorize the Coach to use it only to provide you the service.",
          ],
        },
        {
          title: "8. Availability",
          body: ["We work to keep the platform available, but there may be interruptions due to maintenance or technical or provider failures. We may add, change or remove features."],
        },
        {
          title: "9. Liability",
          body: [
            "You perform the exercises voluntarily and following the instructions received. The Coach is not liable for harm caused by not following instructions, not reporting health conditions or injuries, or providing false information.",
            "Nothing above limits your rights as a consumer under Colombian law (Law 1480 of 2011).",
          ],
        },
        {
          title: "10. Suspension and account deletion",
          body: ["You can delete your account at any time from Profile → Delete my account. The Coach may suspend access if these Terms are breached."],
        },
        {
          title: "11. Personal data",
          body: ["The processing of your data is governed by the Personal Data Processing Policy, which is part of these Terms."],
        },
        {
          title: "12. Changes",
          body: ["If we materially change these Terms, we will let you know in the app and ask you to accept them again."],
        },
        {
          title: "13. Governing law and contact",
          body: [
            "These Terms are governed by the laws of the Republic of Colombia. We will first try to resolve any dispute directly; otherwise, the courts of Medellín will have jurisdiction.",
            `Contact: ${C.email} · phone and WhatsApp +57 ${C.phone}.`,
          ],
        },
      ],
    },
    privacy: {
      title: "Personal Data Processing Policy",
      updated: `Effective as of ${EN_DATE}`,
      sections: [
        {
          title: "1. Data controller",
          body: [
            `${C.name}, an individual (persona natural) domiciled in ${C.city}, who operates the ${C.brand} platform. Email for anything related to your data: ${C.email}. Phone and WhatsApp: +57 ${C.phone}.`,
            "This Policy is issued under Colombian Law 1581 of 2012, Decree 1377 of 2013 (compiled in Decree 1074 of 2015) and the rules that amend or complement them.",
          ],
        },
        {
          title: "2. Definitions",
          body: [
            {
              list: [
                "Data subject: the person the data refers to (you).",
                "Personal data: any information that identifies you or can identify you.",
                "Sensitive data: data that affects your privacy or whose misuse may lead to discrimination, such as health data.",
                "Processing: any operation on data, such as collecting, storing, using or deleting it.",
                "Processor: whoever processes data on behalf of the Controller (for example, the database provider).",
                "Authorization: your prior, express and informed consent.",
              ],
            },
          ],
        },
        {
          title: "3. Data we process",
          body: [
            {
              list: [
                "Identification and contact: name, email, date of birth, profile photo and language.",
                "Training: assigned workouts, completed exercises, sets, weights and reps, progression, badges and activity.",
                "Nutrition: weight, height, age, sex, activity level, goal, training location and meals you log.",
                "Sensitive health data (only if you authorize it): intake form (injuries, medical conditions, medications and restrictions), pain reported in check-ins, body measurements and calculated results, and body progress photos.",
                "Communications: messages with the Coach, weekly check-ins and replies.",
                "Parent or guardian data when the data subject is a minor: name, ID type and number, relationship and email.",
                "Technical data needed for security: sign-in date and time and browser or device type.",
              ],
            },
          ],
        },
        {
          title: "4. Purposes",
          body: [
            "Your data is used to:",
            {
              list: [
                "Create and manage your account and control your access.",
                "Design, adjust and follow up on your training and nutrition goals.",
                "Keep you safe by adapting training to injuries or conditions you report.",
                "Show you your progress, statistics, measurements and badges.",
                "Communicate with you: in-app messages, notices and reminders, and account emails (for example, password recovery).",
                "Handle your inquiries and claims.",
                "Protect the platform's security and prevent fraud.",
                "Comply with legal obligations.",
              ],
            },
            "We do not sell your data or share it with third parties for advertising.",
          ],
        },
        {
          title: "5. Sensitive health data",
          body: [
            "Health data is sensitive data. It is only processed if you (or your representative, if you are a minor) give separate, express authorization, and only to design your training, keep you safe and show your progress.",
            "You are not required to authorize the processing of sensitive data or to answer questions about it. If you do not authorize it, you can keep using the platform, but the health form, body measurements, progress photos and pain reporting will not be available. You can give or withdraw this authorization at any time from Profile → Privacy.",
          ],
        },
        {
          title: "6. Children and adolescents",
          body: [
            "Processing data of people under 18 respects their best interests and fundamental rights. It requires the authorization of their parent or legal representative, given at sign-up, and the minor's opinion will be taken into account according to their maturity. The representative may exercise the data subject's rights at any time.",
          ],
        },
        {
          title: "7. Your rights",
          body: [
            "As data subject you have the right to:",
            {
              list: [
                "Know, update and correct your data.",
                "Request proof of the authorization you gave.",
                "Be informed about how your data is used.",
                "File complaints with Colombia's Superintendence of Industry and Commerce (SIC), after first going through the inquiry or claim process with the Controller.",
                "Withdraw your authorization and request deletion of your data when there is no legal or contractual duty to keep it.",
                "Access your data free of charge.",
              ],
            },
            "You can view and correct much of your data directly in the app, and you can delete your account from Profile.",
          ],
        },
        {
          title: "8. How to exercise your rights",
          body: [
            `Write to ${C.email} (or call +57 ${C.phone}) with your name, your account email, what you are requesting and, for a claim, the facts and any documents you want to rely on.`,
            {
              list: [
                "Inquiries: answered within 10 business days. If that is not possible, we will tell you why and give a new date no more than 5 business days later.",
                "Claims (correction, update, deletion or breach): answered within 15 business days, extendable by up to 8 more business days with notice. If a claim is incomplete, we will ask you to complete it within 5 days; if 2 months pass without a reply, it will be considered withdrawn.",
              ],
            },
          ],
        },
        {
          title: "9. Processors and international transfer",
          body: [
            "To work, the platform uses technology providers that process data on the Controller's behalf and under its instructions: the database, authentication and file storage service (Supabase), the web hosting service and the email delivery service. Their servers may be located outside Colombia, for example in the United States.",
            "By accepting this Policy you authorize the transmission of your data to these providers, solely to provide you the service and with appropriate security measures.",
          ],
        },
        {
          title: "10. Security",
          body: [
            "We apply measures such as encrypted connections (HTTPS), permission-based access control (each client only sees their own information and only the Coach sees their clients'), private storage of progress photos with temporary links, and passwords that no one can see.",
          ],
        },
        {
          title: "11. Retention",
          body: [
            "We keep your data while you have an account. If you delete it, we delete your data and files, except what we must keep under a legal obligation. The record of authorizations is kept as evidence for as long as it may be required.",
          ],
        },
        {
          title: "12. Effective date and changes",
          body: [
            `This Policy is effective as of ${EN_DATE}. The databases will remain in force while the service is provided. If we materially change it, we will let you know in the app and, where applicable, ask for a new authorization.`,
          ],
        },
      ],
    },
  },
};
